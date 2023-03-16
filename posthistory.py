import json
import os
import re

def main():
    """
    Reads the Yuri-Posting-out.log file for previously posted Danbooru image IDs
    and adds them to a database so they can't be posted again.
    """
    ids = []
    if os.path.exists('posthistory.json'):
        with open('posthistory.json', 'r', encoding='utf-8') as file:
            ids = json.load(file)
            print('Loaded post history (' + str(len(ids)) + ' IDs)')
    with open('Yuri-Posting-out.log', 'r', encoding='utf-8') as file:
        for line in file:
            line = line.rstrip()
            match = re.search(r'^  id: (\d+),$', line)
            if match:
                ids.append(int(match.group(1)))
    ids = list(set(ids))
    with open('posthistory.json', 'w', encoding='utf-8') as file:
        json.dump(ids, file, indent=4)
    print('Saved post history (' + str(len(ids)) + ' IDs)')


if __name__ == "__main__":
    main()
