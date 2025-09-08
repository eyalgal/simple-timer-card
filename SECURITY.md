# Security Policy

## Supported Versions

We actively support the latest version of Simple Timer Card with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 1.2.x   | :white_check_mark: |
| 1.1.x   | :x:                |
| < 1.1   | :x:                |

## Security Features

Simple Timer Card v1.2.0+ includes several security enhancements:

### XSS Protection
- All user-provided timer labels are automatically sanitized to prevent script injection
- HTML characters are escaped before rendering in the DOM
- Applies to all timer sources: custom timers, entity names, and parsed data

### Input Validation
- Timer durations are limited to a maximum of 24 hours
- Timer labels are limited to 100 characters
- All numeric inputs are validated for type and range
- Invalid data structures are rejected and logged

### URL Validation
- Audio file URLs are validated to only allow safe protocols (`https:`, `http:`, `file:`)
- Home Assistant local paths (`/local/`, `/hacsfiles/`) are explicitly allowed
- Malicious URLs are blocked and logged

### Data Integrity
- localStorage and MQTT data is validated before use
- Corrupted data is automatically cleaned and reset
- JSON parsing errors are handled gracefully

### Rate Limiting
- Actions are throttled to prevent spam (1 second for timer actions, 500ms for creation)
- Helps prevent performance issues and accidental rapid-fire actions

## Content Security Policy (CSP)

For enhanced security, consider implementing these CSP directives in your Home Assistant setup:

```http
Content-Security-Policy: 
  script-src 'self' 'unsafe-inline' https://unpkg.com/lit@3.1.0;
  connect-src 'self';
  media-src 'self' data: blob: https: http:;
  style-src 'self' 'unsafe-inline';
```

## Reporting a Vulnerability

We take security issues seriously. If you discover a security vulnerability, please follow these steps:

### Where to Report

1. **Private Disclosure**: For security vulnerabilities, please do NOT create a public GitHub issue
2. **Email**: Send reports to the repository owner through GitHub's private vulnerability reporting feature
3. **GitHub Security**: Use GitHub's "Report a vulnerability" button in the Security tab

### What to Include

Please provide as much detail as possible:

- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact and attack scenarios
- Suggested fix (if available)
- Your contact information for follow-up

### Response Timeline

- **Acknowledgment**: We will acknowledge receipt within 48 hours
- **Initial Assessment**: We will provide an initial assessment within 5 business days
- **Fix Development**: We aim to develop and test fixes within 30 days for critical issues
- **Public Disclosure**: We will coordinate with you on appropriate disclosure timing

### Security Best Practices for Users

When using Simple Timer Card:

1. **Keep Updated**: Always use the latest version for security patches
2. **Validate Audio URLs**: Only use trusted sources for audio notifications
3. **Monitor Logs**: Check Home Assistant logs for security warnings
4. **Review Configurations**: Regularly audit your timer card configurations
5. **Backup Data**: Keep backups of your timer configurations

### Known Security Considerations

- Audio files from external URLs could potentially contain malicious content
- MQTT data should come from trusted sources only
- Timer labels from external integrations should be treated as untrusted input
- JavaScript execution context shares the same origin as Home Assistant

## Security Contact

For general security questions or to report issues privately, please use GitHub's security features or contact the maintainer through official channels.

## Acknowledgments

We appreciate security researchers and users who help keep Simple Timer Card secure by responsibly reporting vulnerabilities.