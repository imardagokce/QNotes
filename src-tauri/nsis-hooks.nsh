; NSIS Custom Hooks for QNotes Installer

!macro NSIS_HOOK_POSTINSTALL
  ; Create Desktop Shortcut
  CreateShortCut "$DESKTOP\QNotes.lnk" "$INSTDIR\qnotes.exe" "" "$INSTDIR\qnotes.exe" 0
  
  ; Run application immediately if installed with finish flag or launch directly
  Exec '"$INSTDIR\qnotes.exe"'
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Remove Desktop Shortcut on uninstall
  Delete "$DESKTOP\QNotes.lnk"
!macroend
