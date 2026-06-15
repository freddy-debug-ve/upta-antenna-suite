import numpy as np
from shutil import rmtree
from pathlib import Path
from math import floor

from .download import download
from .unzip import unzip
from .hgt import read_elevation_from_file

CACHE_DIR = Path(__file__).resolve().parent / '.cache'

def get_hgt_name(lat, lon, hgt_dot=True):
    retval = ''

    retval += 'N{:02d}'.format(+int(floor(lat)))
    retval += 'W{:03d}'.format(-int(floor(lon)))
    if hgt_dot:
        retval += '.'
    retval += 'hgt'

    return retval

def get_zip_name(lat, lon):
    return get_hgt_name(lat, lon, lat<=54) + '.zip'

def get_url_for_zip(zip_name):
    # ref: https://github.com/sgherbst/pyhigh/pull/3
    #return f'https://firmware.ardupilot.org/SRTM/North_America/{zip_name}'
    return f'https://www.ve2dbe.com/geodata/srtm1/{zip_name}'

def clear_cache():
    rmtree(CACHE_DIR)

def get_elevation_batch(lat_lon_list, path=CACHE_DIR, rm=True):
    # organize requests by filename
    path = Path(path)
    req_dict = {}
    for k, (lat, lon) in enumerate(lat_lon_list):
        key = int(floor(lat)), int(floor(lon))
        if key not in req_dict:
            req_dict[key] = ([], [], [])
        req_dict[key][0].append(k)
        req_dict[key][1].append(lat)
        req_dict[key][2].append(lon)

    # process the files one-by-one
    retval = np.zeros(len(lat_lon_list))
    for (lat_int, lon_int), (indices, lats, lons) in req_dict.items():
        # find the location of the file
        filename = get_hgt_name(lat_int, lon_int)
        
        fullfile = path / filename
        # download the file if needed
        if not fullfile.is_file():
            # if not determine the URL where it is located
            zip_name = get_zip_name(lat_int, lon_int)
            fullzipname = path / zip_name
            if not fullzipname.is_file():
                url = get_url_for_zip(zip_name)
                # then download the file
                print(f'Downloading {zip_name}')
                path.mkdir(exist_ok=True, parents=True)
                download(url, fullzipname)
            # finally unzip and remove the file
            print(f'Unziping {fullzipname}')
            unzip(fullzipname, remove=rm)
        # process the file
        data = read_elevation_from_file(fullfile, np.array(lats), np.array(lons))
        # write data back into the return value at the appropriate indices
        retval[indices] = data

    # return the elevation data
    return retval

def get_elevation(lat, lon, path=CACHE_DIR, rm=True):
    return get_elevation_batch([(lat, lon)], path=path, rm=rm)[0]

if __name__ == '__main__':
    print(get_elevation(36.52011, -118.671))  # should be 1884
