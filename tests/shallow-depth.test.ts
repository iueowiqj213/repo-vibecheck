import { describe, expect, it } from "vitest";
import { analyzeShallowBody } from "../src/shallow-depth.js";

describe("Python shallow-body analysis", () => {
  it.each([
    ["empty body", "def delete_task(task):\n    \n", "implementation body is empty"],
    ["pass body", "def delete_task(task):\n    pass\n", "implementation body only passes"],
    ["direct parameter return", "def delete_task(task):\n    return task\n", "implementation returns its input unchanged"],
    ["direct return with trailing comment", "def delete_task(task):\n    return task # TODO\n", "implementation returns its input unchanged"]
  ])("classifies Python %s as shallow", (_name, source, reason) => {
    expect(analyzeShallowBody("src/tasks.py", source, 1)).toEqual({ shallow: true, reason });
  });

  it.each([
    ["object return", "def delete_task(task):\n    return {'task': task}\n"],
    ["literal return", "def delete_task(task):\n    return []\n"],
    ["mutation", "def delete_task(task):\n    task['deleted'] = True\n    return task\n"],
    ["branch", "def delete_task(task):\n    if task:\n        return task\n    return None\n"],
    ["transformation", "def delete_task(task):\n    return task.strip()\n"],
    ["validation", "def delete_task(task):\n    if not task:\n        raise ValueError('task')\n    return task\n"],
    ["delegation", "def delete_task(task):\n    return remove_task(task)\n"]
  ])("keeps Python %s substantive", (_name, source) => {
    expect(analyzeShallowBody("src/tasks.py", source, 1)).toEqual({ shallow: false });
  });

  it("ignores a trailing signature comment before analyzing the Python body", () => {
    const source = "def delete_task(task): # delegated implementation\n    return remove_task(task)\n";
    expect(analyzeShallowBody("src/tasks.py", source, 1)).toEqual({ shallow: false });
  });
});

describe("JavaScript and TypeScript shallow-body analysis", () => {
  it.each([
    ["empty function", "export function deleteTask(task: Task): void {}", "implementation body is empty"],
    ["direct function return", "export function deleteTask(task: Task) { return task; }", "implementation returns its input unchanged"],
    ["expression arrow return", "export const deleteTask = (task: Task) => task;", "implementation returns its input unchanged"],
    ["block arrow return", "export const deleteTask = (task: Task) => { return task; };", "implementation returns its input unchanged"]
  ])("classifies TypeScript %s as shallow", (_name, source, reason) => {
    expect(analyzeShallowBody("src/tasks.ts", source, 1)).toEqual({ shallow: true, reason });
  });

  it.each([
    ["object return", "export const deleteTask = (task: Task) => ({ task });"],
    ["literal return", "export const deleteTask = (task: Task) => [];"],
    ["mutation", "export function deleteTask(task: Task) { task.deleted = true; return task; }"],
    ["branch", "export const deleteTask = (task: Task) => task ? task : null;"],
    ["transformation", "export const deleteTask = (task: string) => task.trim();"],
    ["delegation", "export function deleteTask(task: Task) { return removeTask(task); }"],
    ["unbalanced body", "export function deleteTask(task: Task) { return task;"],
    ["ambiguous arrow", "export const deleteTask = (task: Task) => { return task;"]
  ])("keeps TypeScript %s substantive", (_name, source) => {
    expect(analyzeShallowBody("src/tasks.ts", source, 1)).toEqual({ shallow: false });
  });

  it("analyzes an expression arrow without consuming following source lines", () => {
    const source = "export const deleteTask = (task: Task) => task;\nexport const next = true;";
    expect(analyzeShallowBody("src/tasks.ts", source, 1)).toEqual({
      shallow: true,
      reason: "implementation returns its input unchanged"
    });
  });

  it("supports semicolonless expression arrows followed by a new declaration", () => {
    const source = "export const deleteTask = (task: Task) => task\nexport const next = true;";
    expect(analyzeShallowBody("src/tasks.ts", source, 1)).toEqual({
      shallow: true,
      reason: "implementation returns its input unchanged"
    });
  });
});
