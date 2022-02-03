import { _baseOptions } from '../core/yargs';
import {
  getMigrator,
  ensureCurrentMetaSchema,
  addTimestampsToSchema,
} from '../core/migrator';

import helpers from '../helpers';
import index from '../helpers/index';
import _ from 'lodash';
import cliColor from 'cli-color';

function logMigrator(s) {
  if (s.indexOf('Executing') !== 0) {
    index.default.view.log(s);
  }
}

const Sequelize = index.default.generic.getSequelize();

function getSequelizeInstance(args) {
  let config = null;

  try {
    config = index.default.config.readConfig();
  } catch (e) {
    index.default.view.error(e);
  }

  config = _.default.defaults(config, {
    logging: logMigrator,
  });

  try {
    if (args.scheme) config.define = { ...config.define, scheme: args.scheme };
    return new Sequelize(config);
  } catch (e) {
    index.default.view.error(e);
  }
}

exports.builder = (yargs) =>
  _baseOptions(yargs)
    .option('to', {
      describe: 'Migration name to run migrations until',
      type: 'string',
    })
    .option('from', {
      describe: 'Migration name to start migrations from (excluding)',
      type: 'string',
    }).argv;

exports.handler = async function (args) {
  const command = args._[0];

  function logMigrator(s) {
    if (s.indexOf('Executing') !== 0) {
      index.default.view.log(s);
    }
  }

  // legacy, gulp used to do this
  await helpers.config.init();

  let config;
  try {
    config = index.default.config.readConfig();
  } catch (e) {
    index.default.view.error(e);
  }
  config = _.default.defaults(config, {
    logging: logMigrator,
  });

  const { schema, multitenant, multitenantConfig } = { ...config.define };
  const { defaultTable, defaultAttribute } = { ...multitenantConfig };
  const aux = [args.schema || schema || 'public'];
  if (multitenant && !args.schema) {
    try {
      const tenantsSequelize = getSequelizeInstance({
        ...config,
        define: { ...config.define, schema: 'public' },
      });
      let [schemesList] =
        (await tenantsSequelize.query(
          'SELECT * FROM ' + (defaultTable || 'tenants')
        )) || [];
      aux.push(
        ...schemesList.map((data) => data[defaultAttribute || 'scheme'])
      );
    } catch (error) {
      console.log(error);
    }
  }
  for (const schema of aux) {
    args = { ...args, schema };
    console.log(cliColor.bgGreen(schema));
    switch (command) {
      case 'db:migrate':
        await migrate(args);
        break;
      case 'db:migrate:schema:timestamps:add':
        await migrateSchemaTimestampAdd(args);
        break;
      case 'db:migrate:status':
        await migrationStatus(args);
        break;
    }
  }

  process.exit(0);
};

function migrate(args) {
  return getMigrator('migration', args)
    .then((migrator) => {
      return ensureCurrentMetaSchema(migrator)
        .then(() => migrator.pending())
        .then((migrations) => {
          const options = {};
          if (migrations.length === 0) {
            helpers.view.log(
              'No migrations were executed, database schema was already up to date.'
            );
            return options;
          }
          if (args.to) {
            if (
              migrations.filter((migration) => migration.file === args.to)
                .length === 0
            ) {
              helpers.view.log(
                'No migrations were executed, database schema was already up to date.'
              );
              return options;
            }
            options.to = args.to;
          }
          if (args.from) {
            if (
              migrations
                .map((migration) => migration.file)
                .lastIndexOf(args.from) === -1
            ) {
              helpers.view.log(
                'No migrations were executed, database schema was already up to date.'
              );
              return options;
            }
            options.from = args.from;
          }
          return options;
        })
        .then((options) => migrator.up(options));
    })
    .catch((e) => helpers.view.error(e));
}

function migrationStatus(args) {
  return getMigrator('migration', args)
    .then((migrator) => {
      return ensureCurrentMetaSchema(migrator)
        .then(() => migrator.executed())
        .then((migrations) => {
          _.forEach(migrations, (migration) => {
            helpers.view.log('up', migration.file);
          });
        })
        .then(() => migrator.pending())
        .then((migrations) => {
          _.forEach(migrations, (migration) => {
            helpers.view.log('down', migration.file);
          });
        });
    })
    .catch((e) => helpers.view.error(e));
}

function migrateSchemaTimestampAdd(args) {
  return getMigrator('migration', args)
    .then((migrator) => {
      return addTimestampsToSchema(migrator).then((items) => {
        if (items) {
          helpers.view.log('Successfully added timestamps to MetaTable.');
        } else {
          helpers.view.log('MetaTable already has timestamps.');
        }
      });
    })
    .catch((e) => helpers.view.error(e));
}
