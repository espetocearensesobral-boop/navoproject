const fs = require('fs');
const path = require('path');

const filePath = path.join('src', 'components', 'admin', 'FollowUpManagement.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// The file might end with "</div> );};"
content = content.replace(/<\/div>\s*\)\}\s*<\/div>\s*\);\s*\};\s*$/, 
`    </div>
  )}
      {selectedClient && (
        <FollowUpActionModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
        />
      )}
    </div>
  );
};
`);

fs.writeFileSync(filePath, content);
console.log('Fixed render');
