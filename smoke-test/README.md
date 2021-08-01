# Smoke Test

This directory contains a simple smoke test. It checks that with SRI enabled, a
simple page still loads, and that it fails to load when its assets get
corrupted.

The test is meant to run against a packaged version of the plugin, rather than
the source tree. See Yarn script "test:smoke" in the root directory.
