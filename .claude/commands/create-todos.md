I want you to read the @next.md file. This file contains all the things that we want to do next.

I want you to ultrathink about these and then do the following:
1. Find similar issues that targets the same feature and group them as one task with multiple sub-tasks.
2. Evaluate how big this task is between Small, Medium, Large.
3. Evaluate if any task depends on another task.
4. Create a file for each task with the file path tasks/[name].json with the following structure:
{
  "name": "Task Name",
  "description": "Task Description",
  "size": "Small",
  "status": "queued|running|completed",
  "dependencies": ["Task Name"],
  "subtasks": Array with object of tasks
}
