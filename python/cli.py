#!/usr/bin/env python

import subprocess
from os import path
import sys
import shlex

try:
    from shlex import quote as cmd_quote
except ImportError:
    from pipes import quote as cmd_quote

platformToName = {
    'darwin': 'kyso-macos',
    'linux2': 'kyso-linux',
    'win32': 'kyso-win.exe'
}

def main():
    __dirname = path.dirname(path.realpath(__file__))
    argv = sys.argv[1:]

    name = platformToName[sys.platform]
    program = cmd_quote(path.join(__dirname, name))

    args = [program] + argv
    subprocess.call(" ".join(args), shell=True)

if __name__ == '__main__':
    main()
