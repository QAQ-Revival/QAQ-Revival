import json
import tempfile
import unittest
import os
import ctypes
from pathlib import Path
from unittest.mock import patch

import worker


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)

    def write(self, relative, content):
        file = self.root / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(content, encoding="utf-8")
        return file

    def lock_read_only(self, file):
        from ctypes import wintypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        kernel.CreateFileW.restype = wintypes.HANDLE
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        handle = kernel.CreateFileW(str(file), 0x80000000, 1, None, 3, 0, None)
        self.assertNotEqual(handle, wintypes.HANDLE(-1).value)
        return lambda: kernel.CloseHandle(handle)

    def test_staging_keeps_mods_and_caches_out(self):
        self.write("live/Mods/custom/mod.ini", "original mod")
        self.write("live/ShaderCache/a.bin", "cache")
        self.write("live/Core/main.ini", "core")
        self.write("live/d3dx_user.ini", "user state")
        worker.copy_program(self.root / "live", self.root / "candidate")
        self.assertFalse((self.root / "candidate/Mods").exists())
        self.assertFalse((self.root / "candidate/ShaderCache").exists())
        self.assertEqual((self.root / "candidate/d3dx_user.ini").read_text(), "user state")

    def test_commit_preserves_mods_and_removes_only_staged_program_deletions(self):
        self.write("live/Mods/example/mod.ini", "original mod")
        self.write("live/Core/old.ini", "obsolete")
        self.write("next/Core/new.ini", "new core")
        config = self.write("config.json", '{"old":true}')
        work = self.root / "work"
        work.mkdir()
        worker.promote([(self.root / "next", self.root / "live")], work, config, {"new": True})
        self.assertEqual((self.root / "live/Mods/example/mod.ini").read_text(), "original mod")
        self.assertFalse((self.root / "live/Core/old.ini").exists())
        self.assertEqual(json.loads(config.read_text()), {"new": True})

    def test_failed_replacement_restores_prior_program_and_config(self):
        self.write("live/a.dll", "old a")
        self.write("live/b.dll", "old b")
        self.write("next/a.dll", "new a")
        self.write("next/b.dll", "new b")
        config = self.write("config.json", '{"old":true}')
        work = self.root / "work"
        work.mkdir()
        original = worker.os.replace
        def fail_second(source, target):
            if Path(target).name == "b.dll":
                raise OSError("simulated locked DLL")
            return original(source, target)
        with patch.object(worker.os, "replace", side_effect=fail_second):
            with self.assertRaisesRegex(OSError, "locked"):
                worker.promote([(self.root / "next", self.root / "live")], work, config, {})
        self.assertEqual((self.root / "live/a.dll").read_text(), "old a")
        self.assertEqual((self.root / "live/b.dll").read_text(), "old b")
        self.assertEqual(json.loads(config.read_text()), {"old": True})
        self.assertEqual(list((self.root / "live").glob(".qaqr-update-*")), [])

    def test_upstream_signatures_reject_changed_archive(self):
        from core.utils.security import Security
        security = Security()
        security.generate_key_pair()
        signature = security.sign(b"verified release")
        self.assertTrue(security.verify(signature, b"verified release"))
        self.assertFalse(security.verify(signature, b"changed release"))

    @unittest.skipUnless(os.name == "nt", "Windows sharing semantics")
    def test_locked_second_file_restores_successful_first_change(self):
        self.write("live/a.dll", "old a")
        locked = self.write("live/b.dll", "old b")
        self.write("next/a.dll", "new a")
        self.write("next/b.dll", "new b")
        config = self.write("config.json", '{"old":true}')
        work = self.root / "work"
        work.mkdir()
        unlock = self.lock_read_only(locked)
        try:
            with self.assertRaises(OSError):
                worker.promote([(self.root / "next", self.root / "live")], work, config, {})
        finally:
            unlock()
        self.assertEqual((self.root / "live/a.dll").read_text(), "old a")
        self.assertEqual(locked.read_text(), "old b")

    @unittest.skipUnless(os.name == "nt", "Windows sharing semantics")
    def test_incomplete_rollback_restores_other_files_and_keeps_execute_backups(self):
        import core.path_manager as Paths
        import core.config_manager
        import core.config_manager
        from core.packages.launcher_package import LauncherPackage
        Paths.App = Paths.Paths()
        actual = self.root / "live"
        self.write("live/Resources/Bin/XXMI Launcher.exe", "version queried through a mock, never launched")
        for name in ["00.dll", "a.dll", "b.dll"]:
            self.write("live/Resources/" + name, "old " + name)
        original_replace = worker.os.replace
        unlock = []
        def fail_after_locking_updated_file(source, target):
            if Path(target) == actual / "Resources/b.dll":
                unlock.append(self.lock_read_only(actual / "Resources/a.dll"))
                raise OSError("simulated second-file failure")
            return original_replace(source, target)
        def detect(package):
            package.cfg.latest_version = "2.0.0"
        def update(package):
            for name in ["00.dll", "a.dll", "b.dll"]:
                (Paths.App.Root / "Resources" / name).write_text("new " + name)
        try:
            with patch.object(LauncherPackage, "get_file_version", return_value="1.0.0"), patch.object(LauncherPackage, "detect_latest_version", detect), patch.object(LauncherPackage, "update", update), patch.object(worker.os, "replace", side_effect=fail_after_locking_updated_file):
                with self.assertRaises(worker.RecoveryRequiredError) as failure:
                    worker.execute({"action": "install", "root": str(actual), "workRoot": str(self.root / "work")})
            recovery = Path(failure.exception.recovery_path)
            record = json.loads((recovery / "recovery.json").read_text())
            self.assertEqual(len(record["pending"]), 1)
            self.assertTrue(Path(record["pending"][0]["backup"]).exists())
            self.assertEqual((actual / "Resources/00.dll").read_text(), "old 00.dll")
            self.assertEqual((actual / "Resources/a.dll").read_text(), "new a.dll")
            self.assertEqual((actual / "Resources/b.dll").read_text(), "old b.dll")
        finally:
            for close in unlock:
                close()



if __name__ == "__main__":
    unittest.main()
