package main

import (
	"embed"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"

	"EnvManage/backend"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// Create an instance of the app structure
	app := NewApp()
	envManager := backend.NewEnvManager()
	dataManager := backend.NewDataManager(envManager)

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "EnvManage",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 15, G: 23, B: 42, A: 1},
		OnStartup:        app.startup,
		Bind: []interface{}{
			app,
			envManager,
			dataManager,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
