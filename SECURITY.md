# Security Policy

## Supported Versions

Security fixes target the latest stable release. Update to the current release
before reporting an issue that may already be fixed.

| Version | Supported          |
| ------- | ------------------ |
| Latest stable | :white_check_mark: |
| Older releases | :x: |

## Input handling and limitations

These are defensive implementation details, not a security audit or a guarantee
that arbitrary configuration, integrations, or MQTT writers are safe.

### Text rendering
- Timer labels are rendered as text through Lit templates, not interpreted as HTML.
- Basic text handling is not a general-purpose HTML sanitizer. Do not treat timer
  names or other external attributes as trusted commands, URLs, or entity IDs.

### Custom timer input
- Custom entry is limited to positive durations up to **365 days** and names up
  to **100 characters**. The keypad cannot start a zero-duration timer.
- These limits do not describe every external timer or every configuration field.
- Invalid input may be ignored rather than logged or shown as an error.

### Audio URLs
- Audio URLs accept `https:`, `http:`, `file:` and relative HA paths such as
  `/local/` and `/hacsfiles/`. Browser policy may still block playback.
- Protocol checks do not verify the content or reputation of an external host.
  Prefer trusted same-origin audio. Third-party media requests expose request
  metadata to that server.

### Stored and MQTT data
- Local/helper data receives basic shape/type checks. JSON errors are handled,
  but validation and cleanup differ by source; MQTT is not a strict schema gate.
- Broker ACLs should restrict timer-state and event publishers. Payload labels,
  IDs, sources, deadlines and revisions do not authenticate the sender.
- Revisions and deletion tombstones provide best-effort reconciliation, not
  tamper protection, transactional writes, or guaranteed notification delivery.
- HA 2026.10+ requires an admin for direct MQTT publishing. The optional
  [non-admin relay](examples/mqtt_publish_relay.yaml) delegates writes only to
  administrator-selected timer topics. Its topic policy and payload validation
  must remain inside its actions, not caller-overridable variables or skippable
  top-level conditions. Users allowed to invoke it can modify that timer store
  and emit allowed timer events; do not treat these events as authenticated facts.
- Relay validation limits payload shape/size, not every timer field or writer
  identity. Grant control of the relay only to appropriate users. Never embed
  an admin token or broker credentials in dashboard/card configuration.

### Throttling
- Some actions are throttled per card instance, typically for one second, with a
  500 ms custom-creation throttle. Not every service path is throttled.
- These UI safeguards are not an authorization boundary or server rate limit.

## Content Security Policy (CSP)

The release asset bundles Lit; it does not need a Lit CDN allowlist. A blanket
custom CSP can break Home Assistant resources, WebSockets, or other cards.
Configure headers for the whole HA installation and test them there, rather
than copying card-specific permissive directives.

## Reporting a Vulnerability

We take security issues seriously. If you discover a security vulnerability, please follow these steps:

### Where to Report

1. **Private Disclosure**: For security vulnerabilities, please do NOT create a public GitHub issue
2. **Private report**: Use [GitHub's vulnerability reporting page](https://github.com/eyalgal/simple-timer-card/security/advisories/new), or the "Report a vulnerability" button in the Security tab
3. Do not include passwords, tokens, or private broker payloads in a public report

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
3. **Monitor Logs**: Check HA and browser logs when troubleshooting, without assuming every rejected input is logged
4. **Review Configurations**: Regularly audit your timer card configurations
5. **Backup Data**: Keep backups of your timer configurations

### Known Security Considerations

- External audio and MQTT publishers must be trusted.
- Custom tap/service/URL actions execute in the logged-in user's HA context.
  Review dashboard YAML as executable configuration, not just presentation.
- Browser timer data is not encrypted by this card and may be read by other
  same-origin code. Do not put secrets in labels, MQTT payloads, or URLs.
- The card shares Home Assistant's JavaScript origin and user session. It is
  not a sandbox and cannot grant permissions the user does not have.
- Do not rely on this card or example automations for emergency alerts or
  safety-critical equipment shutdown.

## Security Contact

For general security questions or to report issues privately, please use GitHub's security features or contact the maintainer through official channels.

## Acknowledgments

We appreciate security researchers and users who help keep Simple Timer Card secure by responsibly reporting vulnerabilities.