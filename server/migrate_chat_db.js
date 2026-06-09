const { manualMigrate } = require('./migration-utils');

manualMigrate().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});