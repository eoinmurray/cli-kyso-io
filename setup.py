import json
from setuptools import setup

with open('./package.json', 'r') as packageFile:
    packageJSON = json.loads(packageFile.read())

setup(
    name=packageJSON['name'],
    version=packageJSON['version'],
    author=packageJSON['author'],
    author_email=packageJSON['author_email'],
    url=packageJSON['url'],
    description=packageJSON['description'],
    include_package_data=True,
    packages=['python'],
    entry_points = {
        'console_scripts': [
            'kyso = python.cli:main',
        ],
    }
)
