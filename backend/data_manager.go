package backend

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

type Snapshot struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Timestamp string   `json:"timestamp"`
	UserVars  []EnvVar `json:"userVars"`
	SysVars   []EnvVar `json:"sysVars"`
}

type Template struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Desc      string   `json:"desc"`
	Variables []EnvVar `json:"variables"`
	IsPreset  bool     `json:"isPreset"`
}

type Profile struct {
	ID        string   `json:"id"`
	Name      string   `json:"name"`
	Desc      string   `json:"desc"`
	Variables []EnvVar `json:"variables"`
	IsActive  bool     `json:"isActive"`
}

type ConfigData struct {
	Snapshots     []Snapshot `json:"snapshots"`
	Templates     []Template `json:"templates"`
	Profiles      []Profile  `json:"profiles"`
	DisabledPaths []string   `json:"disabledPaths"`
}

type DataManager struct {
	mu         sync.Mutex
	filePath   string
	envManager *EnvManager
}

func NewDataManager(em *EnvManager) *DataManager {
	return &DataManager{
		filePath:   getConfigFilePath(),
		envManager: em,
	}
}

// getConfigFilePath returns the fixed config.json path next to the executable.
func getConfigFilePath() string {
	exePath, err := os.Executable()
	if err != nil {
		return "config.json"
	}
	return filepath.Join(filepath.Dir(exePath), "config.json")
}

// GetConfigPath returns the config.json file path (exposed to frontend).
// Auto-creates the file with default structure if it doesn't exist yet.
func (d *DataManager) GetConfigPath() (string, error) {
	if _, err := os.Stat(d.filePath); os.IsNotExist(err) {
		// Ensure the file exists so Explorer can locate it
		if err := d.save(&ConfigData{
			Snapshots:     []Snapshot{},
			Templates:     []Template{},
			Profiles:      []Profile{},
			DisabledPaths: []string{},
		}); err != nil {
			return "", err
		}
	}
	return d.filePath, nil
}

func (d *DataManager) load() (*ConfigData, error) {
	if _, err := os.Stat(d.filePath); os.IsNotExist(err) {
		return &ConfigData{
			Snapshots:     []Snapshot{},
			Templates:     []Template{},
			Profiles:      []Profile{},
			DisabledPaths: []string{},
		}, nil
	}

	data, err := os.ReadFile(d.filePath)
	if err != nil {
		return nil, err
	}

	var config ConfigData
	err = json.Unmarshal(data, &config)
	if err != nil {
		return nil, err
	}

	if config.Snapshots == nil {
		config.Snapshots = []Snapshot{}
	}
	if config.Templates == nil {
		config.Templates = []Template{}
	}
	if config.Profiles == nil {
		config.Profiles = []Profile{}
	}
	if config.DisabledPaths == nil {
		config.DisabledPaths = []string{}
	}

	return &config, nil
}

func (d *DataManager) save(config *ConfigData) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(d.filePath, data, 0644)
}

// ==================== Snapshots ====================

func (d *DataManager) GetSnapshots() ([]Snapshot, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return nil, err
	}
	return config.Snapshots, nil
}

func (d *DataManager) CreateSnapshot(name string) (Snapshot, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return Snapshot{}, err
	}

	userVars, err := d.envManager.GetVariables(false)
	if err != nil {
		userVars = []EnvVar{}
	}
	sysVars, err := d.envManager.GetVariables(true)
	if err != nil {
		sysVars = []EnvVar{}
	}

	snap := Snapshot{
		ID:        time.Now().Format("20060102150405"),
		Name:      name,
		Timestamp: time.Now().Format("2006-01-02 15:04:05"),
		UserVars:  userVars,
		SysVars:   sysVars,
	}

	config.Snapshots = append(config.Snapshots, snap)
	err = d.save(config)
	if err != nil {
		return Snapshot{}, err
	}

	return snap, nil
}

func (d *DataManager) DeleteSnapshot(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}

	for i, s := range config.Snapshots {
		if s.ID == id {
			config.Snapshots = append(config.Snapshots[:i], config.Snapshots[i+1:]...)
			break
		}
	}

	return d.save(config)
}

func (d *DataManager) RestoreSnapshot(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}

	var snap *Snapshot
	for i := range config.Snapshots {
		if config.Snapshots[i].ID == id {
			snap = &config.Snapshots[i]
			break
		}
	}

	if snap == nil {
		return os.ErrNotExist
	}

	// 1. Restore User Variables
	currUserVars, err := d.envManager.GetVariables(false)
	if err == nil {
		var toDelete []string
		snapKeys := make(map[string]bool)
		for _, v := range snap.UserVars {
			snapKeys[strings.ToUpper(v.Key)] = true
		}
		for _, v := range currUserVars {
			if !snapKeys[strings.ToUpper(v.Key)] {
				toDelete = append(toDelete, v.Key)
			}
		}
		if len(toDelete) > 0 {
			_ = d.envManager.DeleteVariables(false, toDelete)
		}
	}
	if len(snap.UserVars) > 0 {
		_ = d.envManager.SetVariables(false, snap.UserVars)
	}

	// 2. Restore System Variables
	currSysVars, err := d.envManager.GetVariables(true)
	if err == nil {
		var toDelete []string
		snapKeys := make(map[string]bool)
		for _, v := range snap.SysVars {
			snapKeys[strings.ToUpper(v.Key)] = true
		}
		for _, v := range currSysVars {
			if !snapKeys[strings.ToUpper(v.Key)] {
				toDelete = append(toDelete, v.Key)
			}
		}
		if len(toDelete) > 0 {
			_ = d.envManager.DeleteVariables(true, toDelete)
		}
	}
	if len(snap.SysVars) > 0 {
		_ = d.envManager.SetVariables(true, snap.SysVars)
	}

	_ = d.envManager.BroadcastChange()
	return nil
}

// ==================== Templates ====================

func (d *DataManager) GetTemplates() ([]Template, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return nil, err
	}

	presets := d.GetPresets()
	all := append([]Template{}, presets...)
	all = append(all, config.Templates...)
	return all, nil
}

func (d *DataManager) SaveTemplate(t Template) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}

	if t.ID == "" {
		t.ID = time.Now().Format("20060102150405")
	}
	t.IsPreset = false

	found := false
	for i, existing := range config.Templates {
		if existing.ID == t.ID {
			config.Templates[i] = t
			found = true
			break
		}
	}
	if !found {
		config.Templates = append(config.Templates, t)
	}

	return d.save(config)
}

func (d *DataManager) DeleteTemplate(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}

	for i, t := range config.Templates {
		if t.ID == id {
			config.Templates = append(config.Templates[:i], config.Templates[i+1:]...)
			break
		}
	}

	return d.save(config)
}

func (d *DataManager) GetPresets() []Template {
	return []Template{
		{
			ID:       "preset_java",
			Name:     "Java Development Template (Java17+ 开发环境)",
			Desc:     "配置 JAVA_HOME, CLASSPATH 并附加 PATH",
			IsPreset: true,
			Variables: []EnvVar{
				{Key: "JAVA_HOME", Value: `C:\Program Files\Java\jdk-17`, IsSystem: false},
				{Key: "CLASSPATH", Value: `.;%JAVA_HOME%\lib`, IsSystem: false},
				{Key: "PATH", Value: `%JAVA_HOME%\bin`, IsSystem: false}, // Merged into PATH in UI
			},
		},
		{
			ID:       "preset_go",
			Name:     "Go Development Template (Go 开发环境)",
			Desc:     "配置 GOROOT, GOPATH, GOBIN, GOPROXY 并附加 PATH",
			IsPreset: true,
			Variables: []EnvVar{
				{Key: "GOROOT", Value: `C:\Program Files\Go`, IsSystem: false},
				{Key: "GOPATH", Value: `C:\Users\username\go`, IsSystem: false},
				{Key: "GOBIN", Value: `%GOPATH%\bin`, IsSystem: false},
				{Key: "GOPROXY", Value: "https://goproxy.cn,direct", IsSystem: false},
				{Key: "PATH", Value: `%GOROOT%\bin;%GOPATH%\bin`, IsSystem: false},
			},
		},
		{
			ID:       "preset_node",
			Name:     "Node.js Development Template (Node.js 开发环境)",
			Desc:     "配置 NODE_HOME, NODE_PATH, npm 全局目录，并附加 PATH（含 npm prefix/cache 配置）",
			IsPreset: true,
			Variables: []EnvVar{
				{Key: "NODE_HOME", Value: `D:\nodejs\`, IsSystem: false},
				{Key: "NODE_PATH", Value: `D:\nodejs\node_global\node_modules`, IsSystem: false},
				{Key: "npm_config_prefix", Value: `D:\nodejs\node_global`, IsSystem: false},
				{Key: "npm_config_cache", Value: `D:\nodejs\node_cache`, IsSystem: false},
				{Key: "PATH", Value: `%NODE_HOME%;D:\nodejs\node_global`, IsSystem: false},
			},
		},
		{
			ID:       "preset_python",
			Name:     "Python Development Template (Python 开发环境)",
			Desc:     "配置 PYTHON_HOME 并附加 PATH 及 Scripts",
			IsPreset: true,
			Variables: []EnvVar{
				{Key: "PYTHON_HOME", Value: `C:\Users\username\AppData\Local\Programs\Python\Python310`, IsSystem: false},
				{Key: "PATH", Value: `%PYTHON_HOME%;%PYTHON_HOME%\Scripts`, IsSystem: false},
			},
		},
	}
}

// ==================== Profiles ====================

func (d *DataManager) GetProfiles() ([]Profile, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return nil, err
	}
	return config.Profiles, nil
}

func (d *DataManager) SaveProfile(p Profile) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}

	if p.ID == "" {
		p.ID = time.Now().Format("20060102150405")
	}

	found := false
	for i, existing := range config.Profiles {
		if existing.ID == p.ID {
			config.Profiles[i] = p
			found = true
			break
		}
	}
	if !found {
		config.Profiles = append(config.Profiles, p)
	}

	return d.save(config)
}

func (d *DataManager) DeleteProfile(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}

	for i, p := range config.Profiles {
		if p.ID == id {
			config.Profiles = append(config.Profiles[:i], config.Profiles[i+1:]...)
			break
		}
	}

	return d.save(config)
}

func (d *DataManager) ApplyProfile(id string) error {
	// Create auto-backup before profile switch
	_, _ = d.CreateSnapshot("Auto-Backup before profile switch")

	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}

	var targetProfile *Profile
	var activeProfile *Profile

	for i := range config.Profiles {
		if config.Profiles[i].ID == id {
			targetProfile = &config.Profiles[i]
		}
		if config.Profiles[i].IsActive {
			activeProfile = &config.Profiles[i]
		}
	}

	if targetProfile == nil {
		return os.ErrNotExist
	}

	// Delete old variables if they are not in the new profile
	if activeProfile != nil {
		var sysKeysToDelete []string
		var userKeysToDelete []string

		targetKeys := make(map[string]bool)
		for _, v := range targetProfile.Variables {
			targetKeys[strings.ToUpper(v.Key)] = true
		}

		for _, v := range activeProfile.Variables {
			if !targetKeys[strings.ToUpper(v.Key)] {
				if v.IsSystem {
					sysKeysToDelete = append(sysKeysToDelete, v.Key)
				} else {
					userKeysToDelete = append(userKeysToDelete, v.Key)
				}
			}
		}

		if len(sysKeysToDelete) > 0 {
			_ = d.envManager.DeleteVariables(true, sysKeysToDelete)
		}
		if len(userKeysToDelete) > 0 {
			_ = d.envManager.DeleteVariables(false, userKeysToDelete)
		}
	}

	// Set target profile variables
	var sysVarsToSet []EnvVar
	var userVarsToSet []EnvVar

	for _, v := range targetProfile.Variables {
		if v.IsSystem {
			sysVarsToSet = append(sysVarsToSet, v)
		} else {
			userVarsToSet = append(userVarsToSet, v)
		}
	}

	if len(sysVarsToSet) > 0 {
		_ = d.envManager.SetVariables(true, sysVarsToSet)
	}
	if len(userVarsToSet) > 0 {
		_ = d.envManager.SetVariables(false, userVarsToSet)
	}

	// Update active statuses
	for i := range config.Profiles {
		config.Profiles[i].IsActive = (config.Profiles[i].ID == id)
	}

	err = d.save(config)
	if err != nil {
		return err
	}

	_ = d.envManager.BroadcastChange()
	return nil
}

func (d *DataManager) DeactivateProfile(id string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}

	var activeProfile *Profile
	for i := range config.Profiles {
		if config.Profiles[i].ID == id && config.Profiles[i].IsActive {
			activeProfile = &config.Profiles[i]
			config.Profiles[i].IsActive = false
			break
		}
	}

	if activeProfile != nil {
		var sysKeysToDelete []string
		var userKeysToDelete []string
		for _, v := range activeProfile.Variables {
			if v.IsSystem {
				sysKeysToDelete = append(sysKeysToDelete, v.Key)
			} else {
				userKeysToDelete = append(userKeysToDelete, v.Key)
			}
		}

		if len(sysKeysToDelete) > 0 {
			_ = d.envManager.DeleteVariables(true, sysKeysToDelete)
		}
		if len(userKeysToDelete) > 0 {
			_ = d.envManager.DeleteVariables(false, userKeysToDelete)
		}
	}

	err = d.save(config)
	if err != nil {
		return err
	}

	_ = d.envManager.BroadcastChange()
	return nil
}

// ==================== PATH Disable/Enable state ====================

func (d *DataManager) GetDisabledPaths() ([]string, error) {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return nil, err
	}
	return config.DisabledPaths, nil
}

func (d *DataManager) SetDisabledPaths(paths []string) error {
	d.mu.Lock()
	defer d.mu.Unlock()

	config, err := d.load()
	if err != nil {
		return err
	}
	config.DisabledPaths = paths
	return d.save(config)
}
