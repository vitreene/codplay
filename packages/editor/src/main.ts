const demoName = new URL(globalThis.location.href).searchParams.get('demo')

if (demoName === 'dedit') {
  const { runDecorEditorDemo } = await import('./decor-editor/dedit-demo')
  runDecorEditorDemo()
} else {
  await import('./sequence-editor-main')
}
