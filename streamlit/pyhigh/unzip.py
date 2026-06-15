import zipfile
import os

def unzip(path, remove=True):
    # modified from: https://stackoverflow.com/questions/3451111/unzipping-files-in-python
    zip_ref = zipfile.ZipFile(path, 'r')
    zip_ref.extractall(path.parent)
    zip_ref.close()
    if remove: os.remove(path)