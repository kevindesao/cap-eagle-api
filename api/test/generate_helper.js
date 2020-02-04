'use strict';
const Promise = require("bluebird");
const faker = require('faker/locale/en');
Promise.longStackTraces();
const test_helper = require('./test_helper');
const app = test_helper.app;
const mongoose = require('mongoose');
mongoose.Promise = require('bluebird'); // for extra debugging capabilities
//mongoose.Promise = global.Promise;  // without debugging extras
require('../helpers/models/audit');
const factory = require('factory-girl').factory;
const factory_helper = require('./factories/factory_helper');
//the following include statements populate the 'factories' collection of factory-girl's singleton factory object
const listFactory = require("./factories/list_factory");
const auditFactory = require("./factories/audit_factory");
const userFactory = require("./factories/user_factory");
const organizationFactory = require("./factories/organization_factory");
const groupFactory = require("./factories/group_factory");
const projectFactory = require("./factories/project_factory");
const commentPeriodFactory = require("./factories/comment_period_factory");
const commentFactory = require("./factories/comment_factory");
const documentFactory = require("./factories/document_factory");
const recentActivityFactory = require("./factories/recent_activity_factory");
require('../helpers/models/user');
require('../helpers/models/project');
const ft = require('./factory_template');
const gd = require('./generated_data');

// logging levels
let isInfoMode = false;
let isDebugMode = false;

// Used to generate random values in the range [0 to CeilingValue] for correspondingly named objects
let generatorCeilings = {
    extraUsers: 50
  , documentsPerProject: 20
  , commentPeriodsPerProject: 2
  , documentsPerCommentPeriod: 3
  , commentsPerCommentPeriod: 300
  , groupsPerProject: 4
  , organizations: 120
};
let gc = generatorCeilings;

const uniqueStaticSeeds = {
    audit: 1
  , list: 29
  , guaranteedUser: 234
  , extraUser: 106
  , project: 345
  , projectDocument: 105
  , commentPeriod: 101
  , commentPeriodDocument: 104
  , comment: 102
  , group: 924
  , organization: 436
  , recentActivities: 677
};
const uss = uniqueStaticSeeds;

const groupTemplate = new ft.FactoryTemplate(groupFactory.name, generateGroupSetForProject, gc.groupsPerProject, uss.group);
const commentPeriodTemplate = new ft.FactoryTemplate(commentPeriodFactory.name, generateCommentPeriodSetForProject, gc.commentPeriodsPerProject, uss.commentPeriod);
const commentTemplate = new ft.FactoryTemplate(commentFactory.name, generateCommentSetForCommentPeriod, gc.commentsPerCommentPeriod, uss.comment);
const projectDocumentTemplate = new ft.FactoryTemplate(documentFactory.name, generateDocumentSetForProject, gc.documentsPerProject, uss.projectDocument);
const commentPeriodDocumentTemplate = new ft.FactoryTemplate(documentFactory.name, generateDocumentSetForCommentPeriod, gc.documentsPerCommentPeriod, uss.commentPeriodDocument);
const documentRecentActivitiesTemplate = new ft.FactoryTemplate(recentActivityFactory.name, generateRecentActivitiesSetForProjectDocument, 1, uss.recentActivities);
const commentPeriodRecentActivitiesTemplate = new ft.FactoryTemplate(recentActivityFactory.name, generateRecentActivitiesSetForCommentPeriod, 1, uss.recentActivities);

// Data generation violates the single purpose principle on purpose.
// It generates data, saves model to db (mem or real), and outputs the data we generated
// so we can check that it got saved properly later and manipulate the data for tests.
// We do this because we are no longer using static seeded data.
function generateEntireDatabase(usersData) {
  // generate an Audit object needed by the app models, a mix of constant (test entry points) and random Users, and a number of Projects
  return generateProjects(usersData)
  .then(pipeline => { 
    // foreach Project, generate the Groups relating to it
    return new Promise(function(resolve, reject) {
      generateChildSets(pipeline.projects, pipeline.users, pipeline.lists, groupTemplate).then(groups => {
        pipeline.groups = normalizeFactoryResults(groups);
        resolve(pipeline);
      });
    });
  })
  .then(pipeline => { 
    // foreach Project, generate the Comment Periods relating to it
    return new Promise(function(resolve, reject) {
      generateChildSets(pipeline.projects, pipeline.users, pipeline.lists, commentPeriodTemplate).then(commentPeriods => {
        pipeline.commentPeriods = normalizeFactoryResults(commentPeriods);
        resolve(pipeline);
      });
    });
  })
  .then(pipeline => { 
    // foreach Comment Period, generate the Comments relating to it
    return new Promise(function(resolve, reject) {
      generateChildSets(pipeline.commentPeriods, pipeline.users, pipeline.lists, commentTemplate).then(commentPeriodComments => {
        pipeline.commentPeriodComments = normalizeFactoryResults(commentPeriodComments);
        resolve(pipeline);
      });
    });
  })
  .then(pipeline => { 
    // foreach Comment Period, generate the Documents relating to it
    return new Promise(function(resolve, reject) {
      generateChildSetsUsingPipeline(pipeline.commentPeriods, pipeline, commentPeriodDocumentTemplate).then(commentPeriodDocuments => {
        pipeline.commentPeriodDocuments = normalizeFactoryResults(commentPeriodDocuments);
        resolve(pipeline);
      });
    });
  }).then(pipeline => { 
    // foreach Project, generate the Documents relating to it
    return new Promise(function(resolve, reject) {
      generateChildSets(pipeline.projects, pipeline.users, pipeline.lists, projectDocumentTemplate).then(projectDocuments => {
        pipeline.projectDocuments = normalizeFactoryResults(projectDocuments);
        resolve(pipeline);
      });
    });
  }).then(pipeline => { 
    // foreach Project Document, generate a possible Recent Actvity relating to it
    return new Promise(function(resolve, reject) {
      generateChildSets(pipeline.projectDocuments, pipeline.users, pipeline.lists, documentRecentActivitiesTemplate).then(recentActivities => {
        pipeline.projectDocumentRecentActivities = normalizeFactoryResults(recentActivities);
        resolve(pipeline);
      });
    });
  }).then(pipeline => { 
    // foreach Comment Period, generate a possible Recent Actvity relating to it
    return new Promise(function(resolve, reject) {
      generateChildSetsUsingPipeline(pipeline.commentPeriods, pipeline, commentPeriodRecentActivitiesTemplate).then(recentActivities => {
        pipeline.commentPeriodRecentActivities = normalizeFactoryResults(recentActivities);
        resolve(pipeline);
      });
    });
  });
};

function generateGroupSetForProject(factoryKey, project, buildOptions, groupsToGen) {
  console.debug("groupsToGen = " + groupsToGen);
  return new Promise(function(resolve, reject) {
    let customGroupSettings = { project: factory_helper.ObjectId(project._id) };
    factory.createMany(factoryKey, groupsToGen, customGroupSettings, buildOptions).then(groups => {
      let groupIds = [];
      for (i = 0; i < groups.length; i++) {
        if (-1 == groupIds.indexOf(factory_helper.ObjectId(groups[i].id))) groupIds.push(factory_helper.ObjectId(groups[i].id)); 
      }
      project.groups = groupIds;
      resolve(groups);
    });
  });
};

function generateCommentPeriodSetForProject(factoryKey, project, buildOptions, commentPeriodsToGen) {
  console.debug("commentPeriodsToGen = " + commentPeriodsToGen);
  return new Promise(function(resolve, reject) {
    let customCommentPeriodSettings = { project: factory_helper.ObjectId(project._id) };
    factory.createMany(factoryKey, commentPeriodsToGen, customCommentPeriodSettings, buildOptions).then(commentPeriods => {
      resolve(commentPeriods);
    });
  });
};

function generateCommentSetForCommentPeriod(factoryKey, commentPeriod, buildOptions, commentsToGen) {
  console.debug("commentsToGen = " + commentsToGen);
  return new Promise(function(resolve, reject) {
    let customCommentSettings = { commentPeriod: factory_helper.ObjectId(commentPeriod._id) };
    factory.createMany(factoryKey, commentsToGen, customCommentSettings, buildOptions).then(commentPeriodComments => {
      resolve(commentPeriodComments);
    });
  });
};

function generateDocumentSetForProject(factoryKey, project, buildOptions, projectDocumentsToGen) {
  console.debug("projectDocumentsToGen = " + projectDocumentsToGen);
  return new Promise(function(resolve, reject) {
    buildOptions.projectShortName = project.shortName;
    let customDocumentSettings = { documentSource: "PROJECT", project: factory_helper.ObjectId(project._id) };
    factory.createMany(factoryKey, projectDocumentsToGen, customDocumentSettings, buildOptions).then(documents => {
      resolve(documents);
    });
  });
};

function generateDocumentSetForCommentPeriod(factoryKey, commentPeriod, buildOptions, commentPeriodDocumentsToGen) {
  console.debug("commentPeriodDocumentsToGen = " + commentPeriodDocumentsToGen);
  return new Promise(function(resolve, reject) {
  buildOptions.generateFiles = "on";
  let projectsPool = (buildOptions.pipeline) ? buildOptions.pipeline.projects : null;
  const parentProject = projectsPool.filter(project => commentPeriod.project == project.id);
  buildOptions.projectShortName = (1 == parentProject.length) ? parentProject.shortName : documentFactory.unsetProjectName;
  let customDocumentSettings = { documentSource: "COMMENT", project: factory_helper.ObjectId(commentPeriod.project), _comment: factory_helper.ObjectId(commentPeriod._id) };  // note that the document._comment field actually refers to a commentPeriod id
    factory.createMany(factoryKey, commentPeriodDocumentsToGen, customDocumentSettings, buildOptions).then(documents => {
      resolve(documents);
    });
  });
};

function generateRecentActivitiesSetForProjectDocument(factoryKey, projectDocument, buildOptions, projectDocumentRecentActivitiesToGen) {
  console.debug("projectDocumentRecentActivitiesToGen = " + projectDocumentRecentActivitiesToGen);
  return new Promise(function(resolve, reject) {
  let customRecentActivitySettings = { documentUrl: "/api/document/" + projectDocument._id + "/fetch", contentUrl: "", project: factory_helper.ObjectId(projectDocument.project), pcp: null };
    factory.createMany(factoryKey, projectDocumentRecentActivitiesToGen, customRecentActivitySettings, buildOptions).then(recentActivities => {
      resolve(recentActivities);
    });
  });
};

function generateRecentActivitiesSetForCommentPeriod(factoryKey, commentPeriod, buildOptions, commentPeriodRecentActivitiesToGen) {
  console.debug("commentPeriodRecentActivitiesToGen = " + commentPeriodRecentActivitiesToGen);
  return new Promise(function(resolve, reject) {
  let projectsPool = (buildOptions.pipeline) ? buildOptions.pipeline.projects : null;
  const parentProject = projectsPool.filter(project => commentPeriod.project == project.id);
  let contentUrl = (1 == parentProject.length) ? "/p/" + parentProject.shortName + "/commentperiod/" + commentPeriod._id + "" : "";
  let customRecentActivitySettings = { documentUrl: "", contentUrl: contentUrl, project: null, pcp: factory_helper.ObjectId(commentPeriod._id) };
    factory.createMany(factoryKey, commentPeriodRecentActivitiesToGen, customRecentActivitySettings, buildOptions).then(recentActivities => {
      resolve(recentActivities);
    });
  });
};

function generateProjects(usersData) {
  let projectGenerator = new Promise(function(resolve, reject) {
    test_helper.dataGenerationSettings.then(genSettings => {
      let numOfProjsToGen = genSettings.projects;
      let numOfProjsGenned = 0;
      if (isNaN(numOfProjsToGen)) numOfProjsToGen = test_helper.defaultNumberOfProjects;
      console.info('Generating ' + numOfProjsToGen + ' projects.');
      console.debug("documentFactory.MinioControllerBucket = " + documentFactory.MinioControllerBucket);

      factory.create(auditFactory.name, {}, {faker: getSeeded(genSettings.generate_consistent_data, uss.audit)}).then(audit =>{
        audit = normalizeFactoryResults(audit);
        factory.createMany(listFactory.name, listFactory.allLists, {faker: getSeeded(genSettings.generate_consistent_data, uss.list)}).then(lists => {
          lists = normalizeFactoryResults(lists);
          factory.createMany(organizationFactory.name, generatorCeilings.organizations, {}, {faker: getSeeded(genSettings.generate_consistent_data, uss.organization)}).then(organizations => {
            organizations = normalizeFactoryResults(organizations);
            factory.createMany(userFactory.name, usersData, {faker: getSeeded(genSettings.generate_consistent_data, uss.guaranteedUser), orgsPool: organizations}).then(guaranteedUsersArray => {
              guaranteedUsersArray = normalizeFactoryResults(guaranteedUsersArray);
                factory.createMany(userFactory.name, generatorCeilings.extraUsers, {}, {faker: getSeeded(genSettings.generate_consistent_data, uss.extraUser), orgsPool: organizations}).then(extraUsersArray => {
                  extraUsersArray = normalizeFactoryResults(extraUsersArray);
                  let users = guaranteedUsersArray.concat(extraUsersArray);
                  factory.createMany(projectFactory.name, numOfProjsToGen, {}, {faker: getSeeded(genSettings.generate_consistent_data, uss.project), usersPool: users, listsPool: lists, orgsPool: organizations}).then(projectsArray => {
                    numOfProjsGenned = projectsArray.length;
                    let pipeline = new gd.GeneratedData();
                    pipeline.audit = audit;
                    pipeline.lists = lists;
                    pipeline.organizations = organizations;
                    pipeline.users = users;
                    pipeline.projects = projectsArray;
                    resolve(pipeline);
                }).catch(error => {
                    console.log("Project error:" + error);
                    reject(error);
                }).finally(function(){
                    console.info('Generated ' + numOfProjsGenned + ' projects.');
                });
              });
            });
          });
        });
      });
    });
  });
  return projectGenerator;
};

// lightweight for when access to previously generated users and lists is only required
function generateChildSets(parents, usersPool, listsPool, factoryTemplate) {
  let emptyPromise = new Promise(function(resolve, reject) { resolve([]); });
  if (0 == parents.length) return emptyPromise;
  return new Promise(function(resolve, reject) {
    test_helper.dataGenerationSettings.then(genSettings => {
      let childGenerationPromises = [emptyPromise];
      try{
        childGenerationPromises = parents.map(parent => {
          console.debug(factoryTemplate.factoryKey + " parent._id='" + parent._id.toString() + "'");
          let deterministicSeed = factory_helper.generateDeterministicSeed(factoryTemplate.seed, parent._id);
          console.debug(factoryTemplate.factoryKey + " deterministicSeed=" + deterministicSeed);
          let buildOptions = {faker: getSeeded(genSettings.generate_consistent_data, deterministicSeed), usersPool: usersPool, listsPool: listsPool}
          return generateChildSet(parent, buildOptions, factoryTemplate);
        });
      } catch (e) {
        console.debug(factoryTemplate.factoryKey + " typeof parent='" + typeof parent + "'");
        console.debug(factoryTemplate.factoryKey + " parents.length'" + parents.length + "'");
        console.debug(factoryTemplate.factoryKey + " all parents ='" + parents + "'");
      }
      resolve(Promise.all(childGenerationPromises));
    });
  }).catch(error => {
    console.info(factoryTemplate.factoryKey + "s error:" + error);
    reject(error);
  }).finally(function(){
    console.info("Generated all " + factoryTemplate.factoryKey + " sets.");
  });
};

// heavyweight for when full access to previously generated pipeline data is required (ie. we need data from the parent's parent)
function generateChildSetsUsingPipeline(parents, pipeline, factoryTemplate) {
  if (0 == parents.length) return new Promise(function(resolve, reject) { resolve([]); });
  return new Promise(function(resolve, reject) {
    test_helper.dataGenerationSettings.then(genSettings => {
      try{
        let childGenerationPromises = parents.map(parent => {
          try{
            console.debug(factoryTemplate.factoryKey + " parent._id='" + parent._id.toString() + "'");
            let deterministicSeed = factory_helper.generateDeterministicSeed(factoryTemplate.seed, parent._id);
            console.debug(factoryTemplate.factoryKey + " deterministicSeed=" + deterministicSeed);
            let buildOptions = {faker: getSeeded(genSettings.generate_consistent_data, factoryTemplate.seed), pipeline: pipeline};
            return generateChildSet(parent, buildOptions, factoryTemplate);
          } catch (e) {
            console.debug(factoryTemplate.factoryKey + " typeof parent='" + typeof parent + "'");
            console.debug(factoryTemplate.factoryKey + " parents.length'" + parents.length + "'");
            console.debug(factoryTemplate.factoryKey + " all parents ='" + parents + "'");
            console.debug(factoryTemplate.factoryKey + " parent._id lookup. error: " + e + ", parent: " + parent);
          }
        });
        resolve(Promise.all(childGenerationPromises));
      } catch (g) {
        console.debug(factoryTemplate.factoryKey + " all parents ='" + parents + "'");
      }
    });
  }).catch(error => {
    console.info(factoryTemplate.factoryKey + "s error:" + error);
    reject(error);
  }).finally(function(){
    console.info("Generated all " + factoryTemplate.factoryKey + " sets.");
  });
};

function generateChildSet(parent, buildOptions, factoryTemplate) {
  return new Promise(function(resolve, reject) {
    test_helper.dataGenerationSettings.then(genSettings => {
      if (genSettings.generate_consistent_data) {
        let deterministicSeed = factory_helper.generateDeterministicSeed(factoryTemplate.seed, parent._id);
        faker.seed(deterministicSeed)
      } else {
        faker.seed();
      }
      let childrenToGen = faker.random.number(factoryTemplate.upperBound).valueOf();
      if (0 < childrenToGen) {
        resolve(factoryTemplate.factoryMethod(factoryTemplate.factoryKey, parent, buildOptions, childrenToGen));
      } else {
        resolve([]);
      }
    });
  }).catch(error => {
    console.info(factoryTemplate.factoryKey + " set generation error:" + error);
    reject(error);
  }).finally(function(){
    console.info("Generated " + factoryTemplate.factoryKey + " set.");
  });
};

function getSeeded(setConstant, seed) {
  return (setConstant) ? (require('faker/locale/en')).seed(seed) : (require('faker/locale/en')).seed();
};

// the factories return all kinds of array nesting and for our generation usage we wish to deal with straight arrays 
// that we can easily run map functions on.  flatten out any nested arrays factory-girl gives us.
function normalizeFactoryResults(bumpyArrays) {
  console.debug("bumpyArrays.length: " + bumpyArrays.length);
  console.debug("bumpyArrays: " + bumpyArrays);
  if (!bumpyArrays.filter) {
    let newArray = [];  // do not inline with next line because it will not work
    newArray.push(bumpyArrays);
    console.debug(newArray);
    return newArray;
  }
  if ((!!bumpyArrays) && (Array !== bumpyArrays.constructor)) {
    let newArray = [];  // do not inline with next line because it will not work
    newArray.push(bumpyArrays);
    console.debug(newArray);
    return newArray;
  }
  let populatedEntries = bumpyArrays.filter(result => (result));
  let directResults = populatedEntries.filter(result => result.hasOwnProperty('_id'));  //0
  console.debug("directResults.length: " + directResults.length);
  let arraysOfResults = populatedEntries.filter(result => !result.hasOwnProperty('_id'));  //84
  console.debug("arraysOfResults.length: " + arraysOfResults.length);
  let normalizedResults = [];
  try {
    if (directResults) if (0 < directResults.length) normalizedResults = directResults;
    if (arraysOfResults) if (0 < arraysOfResults.length) {
      arraysOfResults.map(test => {
        if (test.hasOwnProperty('_id')) {
          console.debug("arraysOfResults.test = " + test);
          normalizedResults.push(test);
        } else {
          console.debug("arraysOfResults.test -> normalizeFactoryResults() with : " + test);
          normalizeFactoryResults(test).map(result => normalizedResults.push(result));
        }
      });
    }
  } catch (e) {
    console.log("error: " + e);
    console.log("errorstate.directResults.length: " + arraysOfResults.length);
    console.log("errorstate.directResults: " + directResults);
    console.log("errorstate.arraysOfResults.length: " + arraysOfResults.length);
    console.log("errorstate.arraysOfResults: " + arraysOfResults);
  }
  console.debug("normalizedResults.length = " + normalizedResults.length);
  return normalizedResults;
}

console.debug = function(/* ...args */) {
    if (isDebugMode) {
        var vargs = Array.prototype.slice.call(arguments);
        console.log.apply(this, vargs);
    }
};

console.info = function(/* ...args */) {
    if (isInfoMode) {
        var vargs = Array.prototype.slice.call(arguments);
        console.log.apply(this, vargs);
    }
};

exports.uss = uniqueStaticSeeds; // external shorthand alias for brevity
exports.generateEntireDatabase = generateEntireDatabase;
exports.debug = console.debug;
exports.isDebugMode = isDebugMode;
exports.info = console.info;
exports.isInfoMode = isInfoMode;
