package backend

import (
	"os"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows/registry"
)

type EnvManager struct{}

func NewEnvManager() *EnvManager {
	return &EnvManager{}
}

// EnvVar 存储单个环境变量的键值对及层级信息
type EnvVar struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	IsSystem bool   `json:"isSystem"`
}

// GetVariables 获取系统或用户层级的环境变量。
func (e *EnvManager) GetVariables(isSystem bool) ([]EnvVar, error) {
	var k registry.Key
	var err error
	if isSystem {
		k, err = registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.READ)
	} else {
		// Try using standard path
		k, err = registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.READ)
	}
	if err != nil {
		return nil, err
	}
	defer k.Close()

	names, err := k.ReadValueNames(-1)
	if err != nil {
		return nil, err
	}

	var vars []EnvVar
	for _, name := range names {
		val, _, err := k.GetStringValue(name)
		if err == nil {
			vars = append(vars, EnvVar{Key: name, Value: val, IsSystem: isSystem})
		}
	}
	return vars, nil
}

// SetVariable 在系统或用户注册表中新建或更新一个变量。
func (e *EnvManager) SetVariable(isSystem bool, key string, value string) error {
	var k registry.Key
	var err error
	if isSystem {
		k, err = registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.SET_VALUE)
	} else {
		k, err = registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.SET_VALUE)
	}
	if err != nil {
		return err
	}
	defer k.Close()

	if strings.Contains(value, "%") {
		return k.SetExpandStringValue(key, value)
	}
	return k.SetStringValue(key, value)
}

// DeleteVariable 删除指定的环境变量。
func (e *EnvManager) DeleteVariable(isSystem bool, key string) error {
	var k registry.Key
	var err error
	if isSystem {
		k, err = registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.SET_VALUE)
	} else {
		k, err = registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.SET_VALUE)
	}
	if err != nil {
		return err
	}
	defer k.Close()

	return k.DeleteValue(key)
}

// BroadcastChange 向所有顶层窗口广播配置变更消息，使得环境变量修改后免重启即刻生效。
func (e *EnvManager) BroadcastChange() error {
	envStr, err := syscall.UTF16PtrFromString("Environment")
	if err != nil {
		return err
	}
	
	var result uintptr
	user32 := syscall.NewLazyDLL("user32.dll")
	sendMessageTimeout := user32.NewProc("SendMessageTimeoutW")
	
	// WM_SETTINGCHANGE = 0x001A
	// HWND_BROADCAST = 0xFFFF
	// SMTO_ABORTIFHUNG = 0x0002
	sendMessageTimeout.Call(
		uintptr(0xFFFF),
		uintptr(0x001A),
		uintptr(0),
		uintptr(unsafe.Pointer(envStr)),
		uintptr(0x000A), // SMTO_ABORTIFHUNG | SMTO_NOTIMEOUTIFNOTHUNG
		uintptr(5000),
		uintptr(unsafe.Pointer(&result)),
	)
	
	return nil
}

// CheckPathExists 检查指定的路径是否在当前系统中真实存在。
func (e *EnvManager) CheckPathExists(pathStr string) bool {
	expanded := os.ExpandEnv(pathStr)
	_, err := os.Stat(expanded)
	return err == nil
}

// IsAdmin 检查当前程序是否拥有管理员权限（以写入 LOCAL_MACHINE 注册表为标准）
func (e *EnvManager) IsAdmin() bool {
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.SET_VALUE)
	if err == nil {
		k.Close()
		return true
	}
	return false
}

// SetVariables 批量设置环境变量
func (e *EnvManager) SetVariables(isSystem bool, vars []EnvVar) error {
	var k registry.Key
	var err error
	if isSystem {
		k, err = registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.SET_VALUE)
	} else {
		k, err = registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.SET_VALUE)
	}
	if err != nil {
		return err
	}
	defer k.Close()

	for _, v := range vars {
		if strings.Contains(v.Value, "%") {
			err = k.SetExpandStringValue(v.Key, v.Value)
		} else {
			err = k.SetStringValue(v.Key, v.Value)
		}
		if err != nil {
			return err
		}
	}
	return nil
}

// DeleteVariables 批量删除环境变量
func (e *EnvManager) DeleteVariables(isSystem bool, keys []string) error {
	var k registry.Key
	var err error
	if isSystem {
		k, err = registry.OpenKey(registry.LOCAL_MACHINE, `SYSTEM\CurrentControlSet\Control\Session Manager\Environment`, registry.SET_VALUE)
	} else {
		k, err = registry.OpenKey(registry.CURRENT_USER, `Environment`, registry.SET_VALUE)
	}
	if err != nil {
		return err
	}
	defer k.Close()

	for _, key := range keys {
		_ = k.DeleteValue(key) // Ignore error if it doesn't exist
	}
	return nil
}

