from app import add_task, list_task_records, mark_task_done, persist_task_records


def test_add_task():
    assert add_task("write fixture")["done"] is False


def test_list_task_records():
    assert list_task_records([]) == []


def test_mark_task_done():
    assert mark_task_done({"done": False})["done"] is True


def test_persist_task_records(tmp_path):
    path = tmp_path / "tasks.json"
    assert persist_task_records([], path) == []
