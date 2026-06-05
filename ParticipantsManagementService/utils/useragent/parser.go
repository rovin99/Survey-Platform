package useragent

import (
	"regexp"
	"strings"
)

// BrowserInfo contains parsed user agent information
type BrowserInfo struct {
	BrowserName    string
	BrowserVersion string
	OSName         string
	DeviceType     string // desktop, mobile, tablet
	RawUserAgent   string
}

// Parse extracts browser, OS, and device info from a user agent string
func Parse(userAgent string) BrowserInfo {
	info := BrowserInfo{
		RawUserAgent: userAgent,
		DeviceType:   "desktop", // default
	}

	if userAgent == "" {
		info.BrowserName = "Unknown"
		info.OSName = "Unknown"
		return info
	}

	ua := strings.ToLower(userAgent)

	// Detect device type
	if strings.Contains(ua, "mobile") || strings.Contains(ua, "android") && !strings.Contains(ua, "tablet") {
		info.DeviceType = "mobile"
	} else if strings.Contains(ua, "tablet") || strings.Contains(ua, "ipad") {
		info.DeviceType = "tablet"
	}

	// Detect OS
	info.OSName = parseOS(userAgent)

	// Detect browser
	info.BrowserName, info.BrowserVersion = parseBrowser(userAgent)

	return info
}

func parseOS(ua string) string {
	uaLower := strings.ToLower(ua)

	switch {
	case strings.Contains(uaLower, "windows nt 10"):
		return "Windows 10/11"
	case strings.Contains(uaLower, "windows nt 6.3"):
		return "Windows 8.1"
	case strings.Contains(uaLower, "windows nt 6.2"):
		return "Windows 8"
	case strings.Contains(uaLower, "windows nt 6.1"):
		return "Windows 7"
	case strings.Contains(uaLower, "windows"):
		return "Windows"
	case strings.Contains(uaLower, "mac os x"):
		return "macOS"
	case strings.Contains(uaLower, "iphone"):
		return "iOS"
	case strings.Contains(uaLower, "ipad"):
		return "iPadOS"
	case strings.Contains(uaLower, "android"):
		return "Android"
	case strings.Contains(uaLower, "linux"):
		return "Linux"
	case strings.Contains(uaLower, "cros"):
		return "Chrome OS"
	default:
		return "Unknown"
	}
}

func parseBrowser(ua string) (name, version string) {
	uaLower := strings.ToLower(ua)

	// Order matters - check specific browsers first before generic ones
	browsers := []struct {
		name    string
		pattern string
		regex   string
	}{
		{"Edge", "edg/", `Edg/(\d+[\.\d]*)`},
		{"Opera", "opr/", `OPR/(\d+[\.\d]*)`},
		{"Opera", "opera", `Opera/(\d+[\.\d]*)`},
		{"Brave", "brave", `Brave/(\d+[\.\d]*)`},
		{"Vivaldi", "vivaldi", `Vivaldi/(\d+[\.\d]*)`},
		{"Samsung Browser", "samsungbrowser", `SamsungBrowser/(\d+[\.\d]*)`},
		{"Firefox", "firefox", `Firefox/(\d+[\.\d]*)`},
		{"Safari", "safari", `Version/(\d+[\.\d]*)`},
		{"Chrome", "chrome", `Chrome/(\d+[\.\d]*)`},
	}

	for _, b := range browsers {
		if strings.Contains(uaLower, b.pattern) {
			name = b.name
			re := regexp.MustCompile(b.regex)
			if matches := re.FindStringSubmatch(ua); len(matches) > 1 {
				version = matches[1]
			}
			return
		}
	}

	// Check for Safari last (it's in many UAs but often isn't the actual browser)
	if strings.Contains(uaLower, "safari") && !strings.Contains(uaLower, "chrome") {
		name = "Safari"
		re := regexp.MustCompile(`Version/(\d+[\.\d]*)`)
		if matches := re.FindStringSubmatch(ua); len(matches) > 1 {
			version = matches[1]
		}
		return
	}

	return "Unknown", ""
}
