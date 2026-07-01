"use client";

import { Loader2 } from "lucide-react";
import type { ToolInvocation } from "ai";

interface ToolCallBadgeProps {
  toolInvocation: ToolInvocation;
}

function getToolCallLabel(toolInvocation: ToolInvocation): string {
  const { toolName, args } = toolInvocation as {
    toolName: string;
    args: Record<string, unknown>;
  };
  const isComplete = toolInvocation.state === "result";
  const path = typeof args?.path === "string" ? args.path : undefined;

  if (toolName === "str_replace_editor") {
    if (!path) {
      return isComplete ? "Updated file" : "Updating file";
    }

    switch (args?.command) {
      case "create":
        return isComplete ? `Created ${path}` : `Creating ${path}`;
      case "str_replace":
      case "insert":
        return isComplete ? `Edited ${path}` : `Editing ${path}`;
      case "view":
        return isComplete ? `Viewed ${path}` : `Viewing ${path}`;
      case "undo_edit":
        return isComplete
          ? `Reverted changes to ${path}`
          : `Reverting changes to ${path}`;
      default:
        return isComplete ? `Updated ${path}` : `Updating ${path}`;
    }
  }

  if (toolName === "file_manager") {
    const newPath = typeof args?.new_path === "string" ? args.new_path : undefined;

    if (args?.command === "rename") {
      if (path && newPath) {
        return isComplete
          ? `Renamed ${path} to ${newPath}`
          : `Renaming ${path} to ${newPath}`;
      }
      return isComplete ? "Renamed file" : "Renaming file";
    }

    if (args?.command === "delete") {
      return isComplete ? `Deleted ${path ?? "file"}` : `Deleting ${path ?? "file"}`;
    }

    return isComplete ? "Updated files" : "Updating files";
  }

  return toolName;
}

export function ToolCallBadge({ toolInvocation }: ToolCallBadgeProps) {
  const isComplete =
    toolInvocation.state === "result" && Boolean(toolInvocation.result);
  const label = getToolCallLabel(toolInvocation);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isComplete ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
