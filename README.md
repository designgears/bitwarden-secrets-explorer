# Bitwarden Secrets Explorer

A comprehensive VS Code extension for managing Bitwarden Secrets Manager projects and secrets directly in your IDE. Streamline your development workflow with secure secret management, environment variable integration, and seamless .env file operations.

## 🚀 Features

### Project Management
- **Create Projects**: Add new Bitwarden projects with custom names
- **Edit Projects**: Modify project details
- **Delete Projects**: Remove projects with confirmation
- **Browse Projects**: Navigate through your organization's projects in a tree view
- **Copy Project ID**: Quick clipboard access to project identifiers

### Secret Management
- **Create Secrets**: Add new secrets with key-value pairs and notes
- **Edit Secrets**: Full-featured editor with form validation
- **Delete Secrets**: Remove secrets with safety confirmations
- **View Secrets**: Browse all secrets within projects

### Environment Integration
- **Load Single Secret**: Export individual secrets to terminal environment variables
- **Load Project Secrets**: Export all project secrets to terminal at once
- **Cross-Platform Support**: Works with PowerShell, Command Prompt, and Unix shells
- **Terminal Clearing**: Automatically clears terminal history after loading secrets for enhanced privacy

### Clipboard Operations
- **Copy Secret Values**: Copy individual secret values in `key=value` format
- **Copy All Project Secrets**: Copy all secrets from a project as `key=value` pairs (one per line)
- **Ready for .env Files**: Clipboard format is optimized for pasting into environment files

### File Operations
- **Export to .env Files**: Save project secrets to `.env` files with conflict resolution
- **Import from .env Files**: Import secrets from existing `.env*` files into Bitwarden projects
- **Individual Conflict Resolution**: Choose to skip or overwrite each conflicting secret during import
- **Automatic File Discovery**: Finds all `.env*` files in your workspace
- **Format Validation**: Handles comments, empty lines, and quoted values in .env files

### Security & Privacy
- **Secure Authentication**: Token-based authentication with encrypted storage
- **Privacy Protection**: Terminal clearing removes sensitive data from command history
- **Conflict Handling**: Smart detection and resolution of duplicate secrets
- **Error Handling**: Comprehensive error reporting and recovery

## 📋 Setup

1. **Install the Extension**
   - Search for "Bitwarden Secrets Explorer" in VS Code Extensions
   - Or install from the VS Code Marketplace

2. **Configure Authentication**
   ```
   Command Palette → "Bitwarden: Set Access Token"
   ```
   Enter your Bitwarden Secrets Manager API access token

3. **Set Organization**
   ```
   Command Palette → "Bitwarden: Set Organization ID"
   ```
   Enter your Bitwarden organization ID

4. **Access the Panel**
   - Click the Bitwarden icon in the Activity Bar
   - Or use `View → Open View → Bitwarden Secrets Explorer`

## 🔧 Requirements

- **Bitwarden Secrets Manager Subscription**: Active subscription required
- **API Access Token**: Generate from your Bitwarden web vault
- **Organization Access**: Must be a member of a Bitwarden organization
- **VS Code**: Version 1.60.0 or higher

## 📚 Commands Reference

### Authentication Commands
- `Bitwarden: Set Access Token` - Configure API authentication
- `Bitwarden: Set Organization ID` - Set target organization
- `Bitwarden: Clear Tokens` - Remove stored credentials

### Project Commands
- `Create New Project` - Add a new Bitwarden project
- `Edit Project` - Modify project details
- `Delete Project` - Remove a project
- `Copy Project ID` - Copy project identifier to clipboard

### Secret Commands
- `Create New Secret` - Add secrets to projects
- `Edit Secret` - Open secret editor
- `Delete Secret` - Remove secrets
- `Copy to Clipboard` - Copy secret in `key=value` format

### Environment Commands
- `Export Secret to Terminal` - Load individual secret to environment
- `Export Secrets to Terminal` - Load all project secrets to environment
- `Copy All Secrets to Clipboard` - Copy all project secrets as `key=value` pairs
- `Save Secrets to File` - Export project secrets to `.env` file
- `Import Secrets from .env File` - Import secrets from `.env*` files

## 🎯 Usage Examples

### Quick Secret Access
1. Right-click on a secret → "Copy to Clipboard"
2. Paste directly into your `.env` file or configuration

### Environment Setup
1. Right-click on a project → "Export Secrets to Terminal"
2. All secrets are loaded as environment variables
3. Terminal history is automatically cleared for privacy

### .env File Integration
1. Right-click on a project → "Import Secrets from .env File"
2. Select from discovered `.env*` files in your workspace
3. Choose individual conflict resolution for existing secrets
4. Secrets are imported and available across your team

### Bulk Operations
1. Right-click on a project → "Copy All Secrets to Clipboard"
2. Paste into any `.env` file or share with team members
3. Format is ready for immediate use in applications

## 🔒 Security Notes

- **Token Storage**: Access tokens are securely stored using VS Code's secret storage API
- **Terminal Privacy**: Command history is cleared after loading secrets to prevent exposure
- **Conflict Resolution**: Import operations provide granular control over existing secrets
- **Error Handling**: Failed operations don't expose sensitive data in error messages

## 🐛 Troubleshooting

### Common Issues
- **"No projects found"**: Verify your organization ID and access token
- **"Authentication failed"**: Check if your access token is valid and has proper permissions
- **"Import failed"**: Ensure `.env` file format is valid (key=value pairs)

### Getting Help
- Check the VS Code Output panel for detailed error messages
- Verify your Bitwarden Secrets Manager subscription is active
- Ensure you have the necessary permissions in your organization

## 📄 License

All Rights Reserved - see [LICENSE](LICENSE) file.