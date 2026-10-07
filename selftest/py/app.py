import subprocess


def run(x):
    subprocess.call("ls " + x, shell=True)
