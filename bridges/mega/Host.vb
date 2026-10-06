' Host adapters for the unmodified Revival core. No WinForms application is loaded.
Imports System.IO
Imports Newtonsoft.Json

Public Class Configuracion
    Public UsarProxy As Boolean = False
    Public ProxyIP As String = ""
    Public ProxyPort As Integer = 0
    Public ProxyUser As String = ""
    Public ProxyPassword As String = ""
    Public ListaPreSharedKeys As New List(Of Security.SecureString)
End Class

Public Class URLProcessor
    Public Class FileURL
        Public URL As String
        Public Path As String
        Public Sub New(value As String, relative As String)
            URL = value
            Path = relative
        End Sub
    End Class
End Class

Public Class Log
    Public Shared Sub WriteDebug(message As String)
    End Sub
    Public Shared Sub WriteInfo(message As String)
    End Sub
    Public Shared Sub WriteWarning(message As String)
        If message.Contains("download will be incomplete") Then Throw New IOException("Some shared-folder files could not be decrypted; download is incomplete.")
    End Sub
    Public Shared Sub WriteError(message As String)
    End Sub
    Public Shared Function SafeException(ex As Exception) As String
        Return ex.Message
    End Function
    Public Shared Function Redact(message As String) As String
        Return "[redacted]"
    End Function
End Class
