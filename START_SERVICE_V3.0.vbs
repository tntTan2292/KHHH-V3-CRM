Option Explicit

Dim shell, fso
Dim baseDir, backendDir, logDir
Dim pyPath, nodeRoot, npmPath, comspecPath

Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get current directory dynamically
baseDir = fso.GetParentFolderName(WScript.ScriptFullName)
backendDir = baseDir & "\backend"
logDir = baseDir & "\data\logs"

' Paths - Hardened for Portable Node.js (V3.0 Elite)
pyPath = "C:\Users\Admin\AppData\Local\Programs\Python\Python311\python.exe"
nodeRoot = "C:\Users\Admin\nodejs_portable_v22\node-v22.12.0-win-x64"
npmPath = nodeRoot & "\npm.cmd"
comspecPath = shell.ExpandEnvironmentStrings("%ComSpec%")

If Not fso.FolderExists(logDir) Then
    fso.CreateFolder(logDir)
End If

RunHidden """" & pyPath & """ """ & baseDir & "\backend\scripts\governance_cleanup.py"" >> """ & logDir & "\startup_sync.log"" 2>>&1", True
RunHidden """" & pyPath & """ """ & baseDir & "\backend\scripts\check_sync_on_startup.py"" >> """ & logDir & "\startup_sync.log"" 2>>&1", False

If Not IsPortListening(8000) Then
    RunHidden "cd /d """ & backendDir & """ && set PATH=" & nodeRoot & ";%PATH% && """ & pyPath & """ -m uvicorn app.main:app --host 0.0.0.0 --port 8000 >> """ & logDir & "\backend_runtime.log"" 2>>&1", False
End If

WaitForBackend 20

If Not IsPortListening(5181) Then
    ' Elite Hardening: Force PREFIX to portable node root to prevent MODULE_NOT_FOUND
    RunHidden "cd /d """ & baseDir & """ && set PATH=" & nodeRoot & ";%PATH% && set PREFIX=" & nodeRoot & " && """ & npmPath & """ run dev -- --port 5181 --host >> """ & logDir & "\frontend_runtime.log"" 2>>&1", False
End If

' Start Elite Bot Scheduler
RunHidden """" & pyPath & """ """ & baseDir & "\backend\scripts\bot_scheduler.py"" >> """ & logDir & "\bot_scheduler.log"" 2>>&1", False

WScript.Sleep 3000
shell.Run "cmd /c start http://localhost:5181/dashboard", 0, False

Set fso = Nothing
Set shell = Nothing

Sub RunHidden(commandText, waitForExit)
    shell.Run comspecPath & " /c " & commandText, 0, waitForExit
End Sub

Function IsPortListening(port)
    Dim rc, cmd
    cmd = comspecPath & " /c netstat -ano | findstr "":" & port & """ | findstr ""LISTENING"" >nul"
    rc = shell.Run(cmd, 0, True)
    IsPortListening = (rc = 0)
End Function

Function BackendIsHealthy()
    Dim rc, cmd
    cmd = "powershell -NoProfile -ExecutionPolicy Bypass -Command ""try { $r = Invoke-RestMethod 'http://127.0.0.1:8000/api/health' -TimeoutSec 2; if ($r.status -eq 'ok') { exit 0 } else { exit 1 } } catch { exit 1 }"""
    rc = shell.Run(comspecPath & " /c " & cmd, 0, True)
    BackendIsHealthy = (rc = 0)
End Function

Sub WaitForBackend(maxSeconds)
    Dim i
    For i = 1 To maxSeconds
        If BackendIsHealthy() Then Exit Sub
        WScript.Sleep 1000
    Next
End Sub
