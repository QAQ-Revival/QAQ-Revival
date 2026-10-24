"""QAQR transport and transactional staging around the pinned XXMI installer.

Launcher metadata, release selection and ECDSA verification come from upstream.
Game MI packages and runtime libraries are managed by the actual Launcher.
This process never launches a game or an updater GUI.
"""
import hashlib
import json
import os
import shutil
import sys
import tempfile
from pathlib import Path


def emit(value):
    print(json.dumps(value, ensure_ascii=True), flush=True)


def assert_plain(path):
    path = Path(path)
    for item in [path, *path.parents]:
        if item.is_symlink() or (hasattr(item, "is_junction") and item.is_junction()):
            raise ValueError("Linked installation path")


def program_files(root):
    """Program files only. Mods, dumps and generated caches are never staged."""
    result = {}
    if not root.exists():
        return result
    assert_plain(root)
    for directory, names, files in os.walk(root):
        for name in list(names):
            child = Path(directory) / name
            assert_plain(child)
            if name.lower() in {"mods", "shadercache", "backups", "tmp", "qaqm", "qaqr"} or name.lower().startswith("frameanalysis"):
                names.remove(name)
        for name in files:
            file = Path(directory) / name
            assert_plain(file)
            if name.lower().endswith((".log", "_log.txt", ".lnk")):
                continue
            result[file.relative_to(root)] = file
    return result


def digest(file):
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def copy_program(source, destination):
    for relative, file in program_files(source).items():
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(file, target)


class RecoveryRequiredError(RuntimeError):
    def __init__(self, work, original):
        self.recovery_path = str(work)
        super().__init__(f"Automatic rollback is incomplete. Recovery files: {work}. Original error: {original}")


def replace_file(source, target):
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".qaqr-update-", dir=target.parent)
    os.close(fd)
    temporary = Path(name)
    replaced = False
    try:
        shutil.copy2(source, temporary)
        os.replace(temporary, target)
        replaced = True
    finally:
        if not replaced:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass


def promote(groups, work, config_file, config_data):
    """Back up changed files, replace atomically, and restore on any failure."""
    changes = []
    for staged, target in groups:
        before, after = program_files(target), program_files(staged)
        for relative in sorted(before.keys() | after.keys()):
            original, updated = before.get(relative), after.get(relative)
            if original and updated and digest(original) == digest(updated):
                continue
            changes.append((target / relative, updated, digest(original) if original else None))
    config_stage = work / "config-next.json"
    config_stage.write_text(json.dumps(config_data, indent=4), encoding="utf-8")
    changes.append((config_file, config_stage, digest(config_file) if config_file.exists() else None))
    rollback = work / "rollback"
    rollback.mkdir()
    # All backups exist before the first write to the live installation.
    for index, (target, updated, old_hash) in enumerate(changes):
        assert_plain(target)
        if old_hash:
            shutil.copy2(target, rollback / str(index))
            if digest(rollback / str(index)) != old_hash:
                raise ValueError("Backup verification failed")
    previous = next((index for index, (target, _, old_hash) in enumerate(changes) if target == config_file and old_hash), None)
    if previous is not None:
        shutil.copy2(rollback / str(previous), config_file.with_suffix(".json.qaqr-backup"))
    written = []
    try:
        for index, (target, updated, old_hash) in enumerate(changes):
            assert_plain(target)
            current = digest(target) if target.exists() else None
            if current != old_hash:
                raise ValueError("Installation changed while updating")
            if updated:
                replace_file(updated, target)
                written.append(index)
                if digest(target) != digest(updated):
                    raise ValueError("Installed file verification failed")
            elif target.exists():
                target.unlink()
                written.append(index)
    except Exception as original_error:
        failures = []
        for index in reversed(written):
            target, _, old_hash = changes[index]
            try:
                if old_hash:
                    if not target.exists() or digest(target) != old_hash:
                        replace_file(rollback / str(index), target)
                    if digest(target) != old_hash:
                        raise ValueError("Restored file verification failed")
                elif target.exists():
                    target.unlink()
            except Exception as failure:
                failures.append({"target": str(target), "backup": str(rollback / str(index)) if old_hash else None, "sha256": old_hash, "error": str(failure)})
        if failures:
            try:
                (work / "recovery.json").write_text(json.dumps({"protocol": 1, "originalError": str(original_error), "pending": failures}, indent=2), encoding="utf-8")
            except OSError:
                pass
            raise RecoveryRequiredError(work, original_error) from original_error
        raise
    return len(changes)


def newer(candidate, installed):
    if not candidate:
        return False
    if not installed:
        return True
    try:
        return tuple(map(int, candidate.split("."))) > tuple(map(int, installed.split(".")))
    except ValueError:
        return all(part.isdigit() for part in candidate.split("."))


def execute(payload):
    actual = Path(payload["root"])
    if not actual.is_absolute():
        raise ValueError("An absolute installation path is required")
    assert_plain(actual)
    action = payload["action"]
    if action not in {"status", "check", "install"}:
        raise ValueError("Unsupported installer action")
    config_file = actual / "XXMI Launcher Config.json"
    original_config = json.loads(config_file.read_text(encoding="utf-8-sig")) if config_file.exists() else {}
    work = None
    preserve_work = False
    root = actual
    if action == "install":
        import psutil
        for process in psutil.process_iter(["name", "exe"]):
            executable = process.info.get("exe")
            if process.info["name"] == "XXMI Launcher.exe" or (executable and Path(executable).parent == actual / "Resources/Bin"):
                raise ValueError("Close XXMI Launcher before updating it")
        parent = Path(payload["workRoot"])
        assert_plain(parent)
        parent.mkdir(parents=True, exist_ok=True)
        for existing in parent.glob("xxmi-*/*"):
            if existing.name in {"recovery.json", "rollback"}:
                raise RecoveryRequiredError(existing.parent, "A previous rollback still needs recovery")
        work = Path(tempfile.mkdtemp(prefix="xxmi-", dir=parent))
        root = work / "launcher"
        root.mkdir()
        try:
            for name in ["Resources", "Themes", "Locale"]:
                copy_program(actual / name, root / name)
        except Exception:
            shutil.rmtree(work)
            raise
    try:
        import core.path_manager as Paths
        import core.config_manager as Config
        import core.event_manager as Events
        from core.config.enums import UpdateChannel
        from core.package_manager import PackageManager
        from core.packages.launcher_package import LauncherPackage
        Paths.App.set_root_path(root)
        loaded = Config.Manager.config_from_dict(original_config)
        Config.Config.__dict__.update(loaded.__dict__)
        Config.Manager._update_globals()
        Config.Launcher.update_channel = UpdateChannel.ZIP

        class PortableLauncher(LauncherPackage):
            def get_installed_version(self):
                executable = root / "Resources/Bin/XXMI Launcher.exe"
                return self.get_file_version(executable, max_parts=3) if executable.is_file() else ""

            def upgrade_installation(self):
                # Configuration migration belongs to the real Launcher.
                pass

            def get_update_channel(self):
                return UpdateChannel.ZIP

            def install_latest_version(self, clean):
                self.move_contents(self.downloaded_asset_path, root)
                self.verify_files_integrity(root)

        launcher = PortableLauncher()
        manager = PackageManager([launcher])
        manager.github_client.configure(access_token="", verify_ssl=True, proxy_config=Config.Launcher.proxy)
        Events.Subscribe(Events.PackageManager.UpdateDownloadProgress, lambda event: emit({"type": "progress", "stage": "download", "package": "XXMI Launcher", "downloaded": event.downloaded_bytes, "total": event.total_bytes}))
        installed = launcher.get_installed_version()
        latest, error = "", ""
        if action != "status":
            try:
                launcher.detect_latest_version()
                latest = launcher.cfg.latest_version
            except Exception as failure:
                if action == "install":
                    raise
                error = str(failure)
        state = {"id": "Launcher", "installed": installed, "latest": latest, "updateAvailable": newer(latest, installed), "error": error, "source": "https://github.com/SpectrumQT/XXMI-Launcher"}
        if action != "install":
            return {"success": True, "components": [state]}
        installed_packages = []
        if state["updateAvailable"] or not installed:
            emit({"type": "progress", "stage": "install", "package": "XXMI Launcher"})
            launcher.update()
            installed_packages.append("Launcher")
        result_config = json.loads(json.dumps(original_config))
        result_config.setdefault("Launcher", {}).update({"auto_update": False, "update_channel": "ZIP"})
        if installed_packages:
            serialized = Config.Manager.config_to_dict(Config.Config)
            result_config.setdefault("Packages", {}).setdefault("packages", {})["Launcher"] = serialized["Packages"]["packages"]["Launcher"]
        groups = [(root / name, actual / name) for name in ["Resources", "Themes", "Locale"]]
        emit({"type": "progress", "stage": "verify", "package": "XXMI Launcher"})
        count = promote(groups, work, config_file, result_config)
        return {"success": True, "installedPackages": installed_packages, "changedFiles": count}
    except RecoveryRequiredError:
        preserve_work = True
        raise
    finally:
        if work and work.exists():
            if work.parent != Path(payload["workRoot"]) or not work.name.startswith("xxmi-"):
                raise ValueError("Invalid staging cleanup path")
            if not preserve_work and not (work / "recovery.json").exists():
                shutil.rmtree(work)


if __name__ == "__main__":
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        emit({"type": "result", **execute(json.load(sys.stdin))})
    except RecoveryRequiredError as error:
        emit({"type": "result", "success": False, "error": str(error), "code": "RECOVERY_REQUIRED", "recoveryPath": error.recovery_path})
        sys.exit(1)
    except Exception as error:
        emit({"type": "result", "success": False, "error": str(error)})
        sys.exit(1)
