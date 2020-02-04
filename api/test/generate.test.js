'use strict';
const Promise = require("bluebird");
Promise.longStackTraces();
const test_helper = require('./test_helper');
const factory_helper = require('./factories/factory_helper');
const request = require('supertest');
const nock = require('nock');
const gh = require("./generate_helper");

describe('Generate Test Data', () => {
  let adminUser = factory_helper.generateFakePerson('Stanley', '', 'Adminington');
  let publicUser = factory_helper.generateFakePerson('Joe', '', 'Schmo');
  const usersData = [
      {firstName: adminUser.firstName, middleName: adminUser.middleName, lastName: adminUser.lastName, displayName: adminUser.fullName, email: adminUser.emailAddress, read: adminUser.read, write: adminUser.write, delete: adminUser.delete}
    , {firstName: publicUser.firstName, middleName: publicUser.middleName, lastName: publicUser.lastName, displayName: publicUser.fullName, email: publicUser.emailAddress, read: publicUser.read, write: publicUser.write, delete: publicUser.delete}
  ];

  describe('Generate Projects', () => {
    test('Generator', done => {
      test_helper.dataGenerationSettings.then(genSettings => {
        gh.debug(genSettings);

        // Default is to not run the data generator when running global tests
        if (genSettings.generate) {
          console.log("Data Generation is on");
          gh.generateEntireDatabase(usersData).then(generatedData => {
            console.log(((genSettings.generate_consistent_data) ? "Consistent" : "Random") + " data generation " + ((genSettings.save_to_persistent_mongo) ? "saved" : "unsaved"));
            let projects = generatedData.projects;
            gh.debug('projects: [' + projects + ']');
            let documents = generatedData.projectDocuments;

            if (0 == projects.length) {
              expect(1).toEqual(1);
              done();
            }

            generatedData.report();
            projects.map((project) => {
              gh.info('Project [id, name]: [' + project._id + ', ' + project.name + ']');
              expect(project._id).toEqual(jasmine.any(Object));
              expect(project.CELeadEmail).toEqual("eao.compliance@gov.bc.ca");
              gh.debug("total documents.length = " + documents.length);
              if (0 < documents.length) {
                const projectDocuments = documents.filter(document => document.project == project._id);
                gh.debug("projectDocuments.length = " + projectDocuments.length);
                projectDocuments.map((p_document) => {
                  // console.log('document: [' + document + ']');
                  gh.info('Document [id, project, documentFileName]: [' + p_document._id + ', ' + p_document.project + ', ' + p_document.documentFileName + ']');
                });
              }
              
              //TODO:: Check the outputted deterministic data fields against the database model.  Some fields will always have randomness so tests will have to be designed around that.
              
              done();
            });
          });
        } else {
          console.log("Data Generation is off");
          expect(1).toEqual(1);
          done();
        }
      });
    });
  });
});
