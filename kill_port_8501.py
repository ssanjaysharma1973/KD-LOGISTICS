import subprocess
import sys
import re

port = '8501'
try:
    out = subprocess.check_output('netstat -ano', shell=True, text=True)
except Exception as e:
    print('Failed to run netstat:', e)
    sys.exit(1)

pids = set()
for line in out.splitlines():
    if f':{port}' in line:
        parts = re.split(r'\s+', line.strip())
        if parts:
            pid = parts[-1]
            if pid.isdigit():
                pids.add(pid)

if not pids:
    print('No process listening on port', port)
    sys.exit(0)

for pid in sorted(pids):
    print('Killing PID', pid)
    try:
        subprocess.check_call(['taskkill', '/PID', pid, '/F'])
    except Exception as e:
        print('Failed to kill', pid, e)

print('Done')
