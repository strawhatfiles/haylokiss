const fs = require('fs');
const path = require('path');

const baseDirs = ['./Colored-Cover-Stories', './Cover-Stories'];
const manifest = {};

baseDirs.forEach(baseDir => {
    if (fs.existsSync(baseDir)) {
        // 1. SORT THE FOLDERS
        const folders = fs.readdirSync(baseDir)
            .filter(f => fs.statSync(path.join(baseDir, f)).isDirectory())
            .sort((a, b) => {
                // Split at the underscore to get the actual chapter/volume number (e.g., '01.5' or '01')
                const numA = parseFloat(a.split('_')[0]);
                const numB = parseFloat(b.split('_')[0]);
                
                // Sort them mathematically rather than alphabetically
                if (!isNaN(numA) && !isNaN(numB)) {
                    return numA - numB;
                }
                return a.localeCompare(b, undefined, { numeric: true });
            });
        
        folders.forEach(folder => {
            const folderPath = `${baseDir}/${folder}/`;
            
            // 2. SORT THE FILES
            const files = fs.readdirSync(folderPath)
                .filter(file => file.endsWith('.png') || file.endsWith('.jpg'))
                .sort((a, b) => {
                    // Strip the file extension temporarily just for the comparison
                    const baseA = a.replace(/\.(png|jpg)$/, '');
                    const baseB = b.replace(/\.(png|jpg)$/, '');
                    
                    // Now '19' will correctly sort before '19-extra'
                    return baseA.localeCompare(baseB, undefined, { numeric: true, sensitivity: 'base' });
                });
            
            // Save to our dictionary
            manifest[folderPath] = files;
        });
    }
});

// Write the result to manifest.json in the root directory
fs.writeFileSync('manifest.json', JSON.stringify(manifest, null, 2));
console.log('Manifest generated successfully!');