// The process protocol tests belong to the independently buildable worker.
process.env.QAQR_MEGA_TEST_EXE ||= require('node:path').resolve(__dirname, '../build/mega-worker-test/QAQRMegaWorker.exe');
require('../bridges/mega/tests/worker.test.cjs');
