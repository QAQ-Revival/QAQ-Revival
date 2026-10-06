' Used only in the separately compiled test worker, never shipped in app/resources.
Public Class InternalConfiguration
    Public Shared Function ObtenerValueFromInternalConfig(key As String) As String
        If key.StartsWith("URL_MEGA_API") Then Return Environment.GetEnvironmentVariable("QAQM_MEGA_TEST_API") & "?id=%ID%"
        Return ""
    End Function
End Class
