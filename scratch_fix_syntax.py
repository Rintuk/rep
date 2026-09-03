import sys

with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

# The notebook block starts with {/* NOTEBOOK BLOCK */}
# and ends with )}

start_idx = c.find('{/* NOTEBOOK BLOCK */}')
if start_idx != -1:
    end_idx = c.find(')}', start_idx) + 2
    notebook_block = c[start_idx:end_idx]
    
    # Remove the bad block
    c = c[:start_idx] + c[end_idx:]
    
    # Now find the correct place to insert it.
    # We want to insert it INSIDE the grid.
    # The grid is closed after the "Статистика пула" card.
    # Let's find the closing of "Статистика пула"
    
    stat_idx = c.find('Статистика пула')
    if stat_idx != -1:
        # The map ends with ))}
        map_end_idx = c.find('))}\n              </div>\n            </div>', stat_idx)
        if map_end_idx != -1:
            inject_pos = map_end_idx + len('))}\n              </div>\n            </div>')
            
            # Remove the {notebookData && ( and )} from the notebook_block
            # Because we're putting it directly in the grid, we don't strictly need the ternary if we just conditionally render the div
            # Actually, notebookData && ( <div ...> </div> ) is perfectly valid inside a grid!
            # The issue was that the grid was already closed.
            # So we just inject the notebook_block BEFORE the grid's closing div.
            
            c = c[:inject_pos] + '\n\n' + notebook_block + c[inject_pos:]
            
            with open('C:\\temp\\MaklerSite\\frontend\\app\\admin\\page.tsx', 'w', encoding='utf-8') as f:
                f.write(c)
            print("Fixed syntax successfully")
        else:
            print("Failed to find end of map")
    else:
        print("Failed to find stat title")
else:
    print("Notebook block not found")
