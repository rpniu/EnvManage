package main

import (
	"context"
	"fmt"
	"os"
	"os/exec"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// SelectDirectory opens a directory selector dialog and returns the path
func (a *App) SelectDirectory() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "选择文件夹",
	})
}

// SaveFileDialog opens a save file dialog and returns the chosen path
func (a *App) SaveFileDialog(defaultFilename string, filters []runtime.FileFilter) (string, error) {
	return runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "导出环境变量",
		DefaultFilename: defaultFilename,
		Filters:         filters,
	})
}

// OpenFileDialog opens a file picker dialog and returns the chosen path
func (a *App) OpenFileDialog(filters []runtime.FileFilter) (string, error) {
	return runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   "导入环境变量",
		Filters: filters,
	})
}

// WriteFileContent writes string content to a file path
func (a *App) WriteFileContent(path string, content string) error {
	return os.WriteFile(path, []byte(content), 0644)
}

// ReadFileContent reads file content as string from a path
func (a *App) ReadFileContent(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// OpenFileLocation opens Windows Explorer and selects the specified file
func (a *App) OpenFileLocation(filePath string) error {
	cmd := exec.Command("explorer.exe", "/select,", filePath)
	return cmd.Start()
}
