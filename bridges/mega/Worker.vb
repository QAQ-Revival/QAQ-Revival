Imports System.IO
Imports System.Threading
Imports Newtonsoft.Json
Imports Newtonsoft.Json.Linq

Public Module Worker
    Private ReadOnly OutputLock As New Object
    Private ReadOnly ControlLock As New Object
    Private ReadOnly Cancellation As New CancellationTokenSource
    Private ReadOnly PauseGate As New ManualResetEvent(True)
    Private Active As FileDownloader
    Private Paused As Boolean
    Private LastProgress As DateTime = DateTime.MinValue
    Private ReadOnly Pump As New EventPump

    Private Class EventPump
        Inherits SynchronizationContext
        Private ReadOnly Pending As New System.Collections.Concurrent.ConcurrentQueue(Of Action)
        Public Overrides Sub Post(callback As SendOrPostCallback, state As Object)
            Pending.Enqueue(Sub() callback(state))
        End Sub
        Public Sub Drain()
            Dim action As Action = Nothing
            While Pending.TryDequeue(action)
                action()
            End While
        End Sub
    End Class

    Private Class DownloadFile
        Public Info As Conexion.InformacionFichero
        Public Relative As String
        Public ResumePath As String
    End Class

    Public Sub Emit(value As Object)
        SyncLock OutputLock
            Console.WriteLine(JsonConvert.SerializeObject(value))
            Console.Out.Flush()
        End SyncLock
    End Sub

    Private Sub ControlInput()
        Try
            While True
                Dim line As String = Console.ReadLine()
                If line Is Nothing Then
                    Cancellation.Cancel()
                    PauseGate.Set()
                    SyncLock ControlLock
                        If Active IsNot Nothing AndAlso Active.CanStop Then Active.Stop(False)
                    End SyncLock
                    Return
                End If
                Dim command As String = CStr(JObject.Parse(line)("action"))
                SyncLock ControlLock
                    Select Case command
                        Case "pause"
                            Paused = True
                            PauseGate.Reset()
                            If Active IsNot Nothing AndAlso Active.CanPause Then Active.Pause()
                            Emit(New With {.status = "paused"})
                        Case "resume"
                            Paused = False
                            PauseGate.Set()
                            If Active IsNot Nothing AndAlso Active.CanResume Then Active.Resume()
                            Emit(New With {.status = "downloading"})
                        Case "cancel"
                            Cancellation.Cancel()
                            PauseGate.Set()
                            If Active IsNot Nothing AndAlso Active.CanStop Then Active.Stop(False)
                    End Select
                End SyncLock
            End While
        Catch ex As Exception
            Cancellation.Cancel()
            PauseGate.Set()
        End Try
    End Sub

    Private Sub WaitWhilePaused()
        While Not PauseGate.WaitOne(100)
            Cancellation.Token.ThrowIfCancellationRequested()
        End While
        Cancellation.Token.ThrowIfCancellationRequested()
    End Sub

    Private Function Hash(text As String) As String
        Using algorithm As Security.Cryptography.SHA256 = Security.Cryptography.SHA256.Create()
            Return BitConverter.ToString(algorithm.ComputeHash(System.Text.Encoding.UTF8.GetBytes(text))).Replace("-", "").ToLowerInvariant()
        End Using
    End Function

    Private Sub SafeDirectory(root As String, directory As String)
        PathGuard.EnsurePathUnderRoot(root, directory, True)
        Dim current As String = Path.GetFullPath(directory)
        While current.Length >= Path.GetFullPath(root).Length
            If IO.Directory.Exists(current) AndAlso (IO.File.GetAttributes(current) And FileAttributes.ReparsePoint) <> 0 Then
                Throw New IOException("Download directory contains a filesystem link.")
            End If
            If current.Equals(Path.GetFullPath(root), StringComparison.OrdinalIgnoreCase) Then Exit While
            current = Path.GetDirectoryName(current)
        End While
        IO.Directory.CreateDirectory(directory)
    End Sub

    Private Sub SaveResume(file As DownloadFile, downloader As FileDownloader)
        If downloader.File Is Nothing OrElse Not downloader.File.DataPartInitialized OrElse downloader.File.Size <= 0 Then Return
        Dim original As FileDownloader.DataPart = downloader.File.GetDataPart
        Dim saved As New FileDownloader.DataPart
        saved.AllFinished = False
        saved.ChunkList = original.ChunkList.Select(Function(chunk) New FileDownloader.DataPart.Chunk With {
            .StartIndex = chunk.StartIndex, .Size = chunk.Size, .Index = chunk.SyncedIndex,
            .SyncedIndex = chunk.SyncedIndex, .Available = True}).ToList()
        Dim temporary As String = file.ResumePath & ".tmp"
        IO.File.WriteAllText(temporary, JsonConvert.SerializeObject(saved))
        If IO.File.Exists(file.ResumePath) Then
            IO.File.Replace(temporary, file.ResumePath, Nothing)
        Else
            IO.File.Move(temporary, file.ResumePath)
        End If
    End Sub

    Private Sub Run(request As JObject)
        Dim root As String = Path.GetFullPath(CStr(request("directory")))
        SafeDirectory(root, root)
        Dim link As String = CStr(request("url"))
        Dim config As New Configuracion
        Dim urls As New List(Of URLProcessor.FileURL)
        If URLExtractor.IsMegaFolder(link) Then
            urls = MegaFolderHelper.RetrieveLinksFromFolder(URLExtractor.ExtraerFileID(link), URLExtractor.ExtraerFileKey(link),
                URLExtractor.ExtraerSubFolderID(link), URLExtractor.ExtraerSubFileID(link), Nothing, Cancellation.Token)
        Else
            urls.Add(New URLProcessor.FileURL(link, ""))
        End If
        If urls.Count = 0 Then Throw New IOException("This shared folder contains no downloadable files.")
        If urls.Count > 10000 Then Throw New IOException("Too many files in this folder; choose a subfolder link.")
        Dim files As New List(Of DownloadFile)
        Dim usedNames As New HashSet(Of String)(StringComparer.OrdinalIgnoreCase)
        Dim total As Long = 0
        For Each source As URLProcessor.FileURL In urls
            WaitWhilePaused()
            Dim info As Conexion.InformacionFichero = Conexion.ObtenerInformacionFichero(config,
                URLExtractor.ExtraerFileID(source.URL), URLExtractor.ExtraerFileKey(source.URL), True, Cancellation.Token)
            If info.Err <> Conexion.TipoError.SinErrores Then Throw New IOException(info.Errtxt)
            Dim relative As String = PathGuard.CombineSafeRelativePath(If(source.Path, "").TrimEnd("\"c, "/"c), PathGuard.SanitizeFileName(info.Nombre))
            If Not usedNames.Add(relative) Then
                relative = Path.Combine(Path.GetDirectoryName(relative), Path.GetFileNameWithoutExtension(relative) & "-" & Hash(source.URL).Substring(0, 8) & Path.GetExtension(relative))
                If Not usedNames.Add(relative) Then Throw New IOException("Duplicate paths in shared folder.")
            End If
            Dim file As New DownloadFile With {.Info = info, .Relative = relative, .ResumePath = Path.Combine(root, ".resume-" & Hash(source.URL) & ".json")}
            files.Add(file)
            total += info.Tamano
            Emit(New With {.status = If(Paused, "paused", "checking"), .filesTotal = urls.Count, .filesScanned = files.Count, .currentFile = relative, .total = total})
        Next
        Dim downloaded As Long = 0
        Dim completed As Integer = 0
        For Each file As DownloadFile In files
            WaitWhilePaused()
            Dim target As String = PathGuard.GetSafePathUnderRoot(root, file.Relative, False)
            Dim directory As String = Path.GetDirectoryName(target)
            SafeDirectory(root, directory)
            ' Completed files are reused only after checking their MEGA MetaMAC.
            If IO.File.Exists(target) AndAlso New IO.FileInfo(target).Length = file.Info.Tamano AndAlso Criptografia.VerifyMegaMetaMac(target, file.Info.FileKey) Then
                downloaded += file.Info.Tamano
                completed += 1
                Continue For
            End If
            Dim resumeState As FileDownloader.DataPart = Nothing
            If IO.File.Exists(file.ResumePath) Then
                Try
                    resumeState = JsonConvert.DeserializeObject(Of FileDownloader.DataPart)(IO.File.ReadAllText(file.ResumePath))
                Catch ex As Exception
                    resumeState = Nothing
                End Try
            End If
            Using downloader As New FileDownloader(True)
                downloader.PartsPerFile = 4
                downloader.NumConnections = 4
                downloader.LocalDirectory = directory
                downloader.DeleteFilesAfterCancel = False
                downloader.DeleteCompletedFilesAfterCancel = False
                downloader.AddFileInfo(file.Info.FileID, file.Info.FileKey, file.Info.URL, Path.GetFileName(target), resumeState)
                Dim stopped As Boolean = False
                Dim succeeded As Boolean = False
                Dim failure As Exception = Nothing
                AddHandler downloader.FileDownloadSucceeded, Sub(sender, args) succeeded = True
                AddHandler downloader.FileDownloadFailed, Sub(sender, ex) failure = ex
                AddHandler downloader.Stopped, Sub(sender, args) stopped = True
                SyncLock ControlLock
                    Active = downloader
                    downloader.Start()
                    If Paused Then downloader.Pause()
                End SyncLock
                While Not stopped
                    Pump.Drain()
                    If Cancellation.IsCancellationRequested AndAlso downloader.CanStop Then downloader.Stop(False)
                    If (DateTime.UtcNow - LastProgress).TotalMilliseconds >= 300 Then
                        LastProgress = DateTime.UtcNow
                        SaveResume(file, downloader)
                        Dim doneBytes As Long = Math.Min(total, downloaded + downloader.TotalProgress)
                        Emit(New With {.status = If(Paused, "paused", "downloading"), .downloaded = doneBytes, .total = total,
                            .percent = If(total > 0, Math.Min(99.0, CDbl(doneBytes) / total * 100), 0),
                            .speed = downloader.DownloadSpeed, .currentFile = file.Relative, .filesCompleted = completed, .filesTotal = files.Count})
                    End If
                    Thread.Sleep(50)
                End While
                Pump.Drain()
                SaveResume(file, downloader)
                SyncLock ControlLock
                    Active = Nothing
                End SyncLock
                Cancellation.Token.ThrowIfCancellationRequested()
                If Not succeeded Then Throw If(failure, New IOException("Download did not finish successfully."))
                If IO.File.Exists(file.ResumePath) Then IO.File.Delete(file.ResumePath)
            End Using
            downloaded += file.Info.Tamano
            completed += 1
        Next
        Emit(New With {.status = "completed", .downloaded = total, .total = total, .percent = 100, .speed = 0, .filesCompleted = completed, .filesTotal = files.Count, .archivePath = root})
    End Sub

    Public Sub Main()
        Console.InputEncoding = New Text.UTF8Encoding(False)
        Console.OutputEncoding = New Text.UTF8Encoding(False)
        SynchronizationContext.SetSynchronizationContext(Pump)
        Try
            Dim line As String = Console.ReadLine()
            If line Is Nothing OrElse line.Length > 40000 Then Throw New ArgumentException("Invalid request")
            Dim request As JObject = JObject.Parse(line)
            Dim reader As New Thread(AddressOf ControlInput)
            reader.IsBackground = True
            reader.Start()
            Run(request)
        Catch ex As OperationCanceledException
            Emit(New With {.status = "canceled", .error = "下载已取消，已保留断点"})
        Catch ex As Exception
            Dim quota As Boolean = MegaQuotaManager.IsQuarantined() OrElse Conexion.IsQuotaErrorText(ex.Message)
            Emit(New With {.status = "error", .code = If(quota, "MEGA_QUOTA", "MEGA_DOWNLOAD_FAILED"),
                .error = If(quota, "MEGA 流量额度已用尽，请稍后重试；已保留下载进度。", ex.Message)})
        Finally
            Cancellation.Cancel()
        End Try
    End Sub
End Module
