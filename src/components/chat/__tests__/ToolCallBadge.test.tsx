import { test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallBadge } from "../ToolCallBadge";
import type { ToolInvocation } from "ai";

afterEach(() => {
  cleanup();
});

test("shows 'Creating <file>' while a create call is in progress", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "Counter.jsx" },
    state: "call",
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Creating Counter.jsx")).toBeDefined();
});

test("shows 'Created <file>' once a create call has a result", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "Counter.jsx" },
    state: "result",
    result: "File created",
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Created Counter.jsx")).toBeDefined();
});

test("shows 'Editing <file>' for an in-progress str_replace command", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "str_replace", path: "App.jsx" },
    state: "call",
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Editing App.jsx")).toBeDefined();
});

test("shows 'Edited <file>' for a completed insert command", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "insert", path: "App.jsx" },
    state: "result",
    result: "Inserted",
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Edited App.jsx")).toBeDefined();
});

test("shows 'Viewed <file>' for a completed view command", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "view", path: "App.jsx" },
    state: "result",
    result: "file contents",
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Viewed App.jsx")).toBeDefined();
});

test("falls back to a generic message when the path isn't known yet", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: {},
    state: "partial-call",
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Updating file")).toBeDefined();
});

test("shows 'Renaming <old> to <new>' for an in-progress rename", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "file_manager",
    args: { command: "rename", path: "Old.jsx", new_path: "New.jsx" },
    state: "call",
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Renaming Old.jsx to New.jsx")).toBeDefined();
});

test("shows 'Renamed <old> to <new>' for a completed rename", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "file_manager",
    args: { command: "rename", path: "Old.jsx", new_path: "New.jsx" },
    state: "result",
    result: { success: true },
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("Renamed Old.jsx to New.jsx")).toBeDefined();
});

test("shows 'Deleting <file>' and 'Deleted <file>' for delete commands", () => {
  const inProgress = {
    toolCallId: "1",
    toolName: "file_manager",
    args: { command: "delete", path: "Old.jsx" },
    state: "call",
  } as ToolInvocation;

  const { rerender } = render(<ToolCallBadge toolInvocation={inProgress} />);
  expect(screen.getByText("Deleting Old.jsx")).toBeDefined();

  const completed = {
    toolCallId: "1",
    toolName: "file_manager",
    args: { command: "delete", path: "Old.jsx" },
    state: "result",
    result: { success: true },
  } as ToolInvocation;

  rerender(<ToolCallBadge toolInvocation={completed} />);
  expect(screen.getByText("Deleted Old.jsx")).toBeDefined();
});

test("falls back to the raw tool name for unknown tools", () => {
  const toolInvocation = {
    toolCallId: "1",
    toolName: "some_other_tool",
    args: {},
    state: "call",
  } as ToolInvocation;

  render(<ToolCallBadge toolInvocation={toolInvocation} />);

  expect(screen.getByText("some_other_tool")).toBeDefined();
});

test("shows a loading spinner while in progress and a status dot when complete", () => {
  const inProgress = {
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "Counter.jsx" },
    state: "call",
  } as ToolInvocation;

  const { container, rerender } = render(
    <ToolCallBadge toolInvocation={inProgress} />
  );
  expect(container.querySelector(".animate-spin")).not.toBeNull();
  expect(container.querySelector(".bg-emerald-500")).toBeNull();

  const completed = {
    toolCallId: "1",
    toolName: "str_replace_editor",
    args: { command: "create", path: "Counter.jsx" },
    state: "result",
    result: "Success",
  } as ToolInvocation;

  rerender(<ToolCallBadge toolInvocation={completed} />);
  expect(container.querySelector(".animate-spin")).toBeNull();
  expect(container.querySelector(".bg-emerald-500")).not.toBeNull();
});
