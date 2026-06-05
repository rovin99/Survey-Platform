package useragent

import (
	"strings"
)

// ParsedUserAgent contains parsed browser and device information
type ParsedUserAgent struct {
	BrowserName string
	DeviceType  string
}

// Parse extracts browser and device information from a User-Agent string
func Parse(userAgent string) ParsedUserAgent {
	result := ParsedUserAgent{
		BrowserName: "Unknown",
		DeviceType:  "desktop",
	}

	if userAgent == "" {
		return result
	}

	ua := strings.ToLower(userAgent)

	// Detect device type
	if strings.Contains(ua, "mobile") || strings.Contains(ua, "android") && !strings.Contains(ua, "tablet") {
		result.DeviceType = "mobile"
	} else if strings.Contains(ua, "tablet") || strings.Contains(ua, "ipad") {
		result.DeviceType = "tablet"
	}

	// Detect browser - order matters (most specific first)
	switch {
	case strings.Contains(ua, "edg/") || strings.Contains(ua, "edge/"):
		result.BrowserName = "Edge"
	case strings.Contains(ua, "opr/") || strings.Contains(ua, "opera"):
		result.BrowserName = "Opera"
	case strings.Contains(ua, "brave"):
		result.BrowserName = "Brave"
	case strings.Contains(ua, "vivaldi"):
		result.BrowserName = "Vivaldi"
	case strings.Contains(ua, "chrome") && !strings.Contains(ua, "chromium"):
		result.BrowserName = "Chrome"
	case strings.Contains(ua, "firefox"):
		result.BrowserName = "Firefox"
	case strings.Contains(ua, "safari") && !strings.Contains(ua, "chrome"):
		result.BrowserName = "Safari"
	case strings.Contains(ua, "msie") || strings.Contains(ua, "trident"):
		result.BrowserName = "Internet Explorer"
	case strings.Contains(ua, "curl"):
		result.BrowserName = "curl"
	case strings.Contains(ua, "postman"):
		result.BrowserName = "Postman"
	case strings.Contains(ua, "bot") || strings.Contains(ua, "crawler") || strings.Contains(ua, "spider"):
		result.BrowserName = "Bot"
		result.DeviceType = "bot"
	}

	return result
}

