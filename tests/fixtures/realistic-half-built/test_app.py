from app import (
    add_task,
    delete_task,
    edit_task,
    filter_open_task_records,
    list_task_records,
    mark_task_done,
    persist_task_records,
    prioritize_task_records,
)


def test_add_task():
    assert add_task("write fixture")["done"] is False


def test_list_task_records():
    assert list_task_records([]) == []


def test_mark_task_done():
    assert mark_task_done({"done": False})["done"] is True


def test_persist_task_records(tmp_path):
    path = tmp_path / "tasks.json"
    assert persist_task_records([], path) == []


def test_delete_task():
    task = {"title": "write fixture"}
    assert delete_task(task) == task


def test_edit_task():
    task = {"title": "write fixture"}
    assert edit_task(task) == task


def test_prioritize_task_records():
    tasks = [{"title": "write fixture"}]
    assert prioritize_task_records(tasks) == tasks


def test_filter_open_task_records():
    tasks = [{"title": "write fixture", "done": False}]
    assert filter_open_task_records(tasks) == tasks
