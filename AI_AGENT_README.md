# AI Agent Feature Documentation

## Overview

The AI Agent feature allows you to perform multi-step database operations using natural language commands. It's powered by Groq's `llama-3.3-70b-versatile` model with function calling capabilities.

## API Endpoint

**POST** `/api/ai-agent`

### Request Body
```json
{
  "prompt": "Your natural language command here"
}
```

### Response Format
```json
{
  "success": true,
  "message": "Completed 2 operation(s) successfully.",
  "operations": [
    {
      "tool": "create_project",
      "status": "success",
      "result": {
        "project": {
          "id": "uuid-here",
          "name": "Project Name",
          "description": "...",
          "status": "active",
          "color": "#4f6ff5",
          "category": null,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      }
    }
  ]
}
```

## Available Tools

### 1. `get_team_members`
Retrieves all team members from the database.

**Example:**
```
"Get all team members"
"Show me the team"
"List all engineers"
```

**Response:**
```json
{
  "members": [
    {
      "id": "uuid",
      "nick": "Mihir",
      "role": "Engineer",
      "createdAt": "..."
    }
  ]
}
```

---

### 2. `create_template`
Creates a new check-in template with optional goal areas and goals.

**Parameters:**
- `name` (required): Template name
- `description` (optional): Template description
- `goalAreas` (optional): Array of goal areas with nested goals

**Example:**
```
"Create a template called 'Weekly Sync' with description 'Weekly team sync template'"

"Create a quarterly check-in template with goal areas for 'Engineering Excellence' and 'Customer Success'"
```

**Response:**
```json
{
  "template": {
    "id": "uuid",
    "name": "Weekly Sync",
    "description": "Weekly team sync template",
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

---

### 3. `create_project`
Creates a new project in the database.

**Parameters:**
- `name` (required): Project name
- `description` (optional): Project description
- `status` (optional): "active" | "on-hold" | "completed" (default: "active")
- `color` (optional): Hex color code (default: "#4f6ff5")
- `category` (optional): Project category

**Example:**
```
"Create a project called 'Q1 Planning'"

"Make a new project 'Infrastructure Upgrade' with status on-hold and category 'DevOps'"
```

**Response:**
```json
{
  "project": {
    "id": "uuid",
    "name": "Q1 Planning",
    "description": null,
    "status": "active",
    "color": "#4f6ff5",
    "category": null,
    "createdAt": "..."
  }
}
```

---

### 4. `create_requirement`
Creates a new requirement/task for a project.

**Parameters:**
- `projectId` (required): UUID of the project (can be auto-filled from previous `create_project`)
- `name` (required): Requirement name
- `description` (optional): Requirement description
- `type` (required): "recurring" | "one-time"
- `recurrence` (optional): "daily" | "weekly" | "monthly" | "quarterly" (required if type is recurring)
- `dueDate` (required): Date in YYYY-MM-DD format
- `ownerId` (optional): UUID of team member assigned
- `isPerMemberCheckIn` (optional): Boolean for per-member check-ins
- `templateId` (optional): UUID of check-in template (can be auto-filled from previous `create_template`)

**Example:**
```
"Add a one-time requirement 'Review goals' due tomorrow to the project"

"Create a quarterly recurring task 'Team sync' due 2024-03-31 and assign to Mihir"
```

**Response:**
```json
{
  "requirement": {
    "id": "uuid",
    "projectId": "uuid",
    "name": "Review goals",
    "description": null,
    "type": "one-time",
    "recurrence": null,
    "dueDate": "2024-01-15",
    "status": "pending",
    "ownerId": null,
    "isPerMemberCheckIn": false,
    "templateId": null,
    "createdAt": "..."
  }
}
```

---

## Multi-Step Operations

The AI agent can execute multiple operations in sequence and share context between them:

**Example 1: Create project and add requirement**
```
"Create a project called 'Q1 Goals' and add a one-time requirement 'Initial planning' due 2024-03-15"
```

This will:
1. Create the project
2. Automatically use the created project's ID for the requirement

**Example 2: Create template and use it in a requirement**
```
"Create a template called 'Check-In', then make a project 'Team Reviews', and add a quarterly requirement due 2024-04-01 using that template"
```

This will:
1. Create the template
2. Create the project
3. Create the requirement with the template automatically linked

**Example 3: Find team member and assign**
```
"Get team members, then create a project 'Infrastructure' and assign it to Mihir"
```

This will:
1. Fetch all team members
2. Create the project
3. Use the found team member ID for assignment (Note: assignment tool not yet implemented)

---

## Error Handling

The API returns detailed error information for each operation:

```json
{
  "success": false,
  "message": "Completed 1 operation(s) successfully, 1 failed.",
  "operations": [
    {
      "tool": "create_project",
      "status": "success",
      "result": { ... }
    },
    {
      "tool": "create_requirement",
      "status": "error",
      "error": "projectId is required"
    }
  ]
}
```

---

## Best Practices

1. **Be specific with dates**: Use ISO format (YYYY-MM-DD) or relative terms like "tomorrow", "next week"
2. **Use clear names**: The AI works best with explicit names for projects, templates, and requirements
3. **Chain operations**: When creating related items, mention them in one prompt for automatic linking
4. **Check team members first**: If assigning by name, start with "Get team members" to find IDs

---

## Usage from UI

Navigate to `/ai` in your OpSync app to use the interactive AI assistant interface. The UI provides:

- Text area for natural language commands
- Example prompts to get started
- Real-time operation status display
- Expandable JSON results for debugging

---

## Technical Details

- **Model**: `llama-3.3-70b-versatile` via Groq API
- **Function Calling**: Uses Groq's native function calling for structured tool execution
- **Sequential Execution**: Tools are executed in order with context sharing
- **No Transactions**: Currently operations are not wrapped in database transactions (enhancement opportunity)
- **Environment Variable**: Requires `GROQ_API_KEY` in `.env.local`

---

## Future Enhancements

- [ ] Add database transaction support for atomic multi-step operations
- [ ] Implement `assign_project` tool for team member assignment
- [ ] Add `update_*` and `delete_*` tools for modifications
- [ ] Support for bulk operations (e.g., "Create 5 requirements")
- [ ] Add conversation memory for follow-up commands
- [ ] Implement confirmation step before executing operations
