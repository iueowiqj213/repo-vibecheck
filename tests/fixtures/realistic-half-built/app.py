import json


def add_task(task):
    if not task:
        raise ValueError("A task name is required")
    return {"title": task, "done": False}


def list_task_records(tasks):
    return tasks


def mark_task_done(task):
    task["done"] = True
    return task


def persist_task_records(tasks, path):
    path.write_text(json.dumps(tasks))
    return tasks


def delete_task(task):
    return task


def edit_task(task):
    return task


def prioritize_task_records(tasks):
    return tasks


def filter_open_task_records(tasks):
    return tasks


# TODO: replace the in-memory task storage
