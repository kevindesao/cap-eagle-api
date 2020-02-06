const factory = require('factory-girl').factory;
const factory_helper = require('./factory_helper');
const moment = require('moment');
const Document = require('../../helpers/models/document');
const uploadDir = require('../../controllers/document').uploadDir;
const fs = require('fs');
const MinioController = require('../../helpers/minio');
let faker = require('faker/locale/en');

const factoryName = Document.modelName;

const unsetProjectName = "the-project-name";

const docProps = [
    { ext: "jpg", mime: "image/jpeg" }
  , { ext: "jpeg", mime: "image/jpeg" }
  , { ext: "gif", mime: "image/gif" }
  , { ext: "png", mime: "image/png" }
  , { ext: "bmp", mime: "image/bmp" }
  , { ext: "doc", mime: "application/msword" }
  , { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }
  , { ext: "xls", mime: "application/vnd.ms-excel" }
  , { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }
  , { ext: "ppt", mime: "application/vnd.ms-powerpoint" }
  , { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" }
  , { ext: "pdf", mime: "application/pdf" }
  , { ext: "txt", mime: "text/plain" }
];

factory.define(factoryName, Document, buildOptions => {
  if (buildOptions.faker) faker = buildOptions.faker;
  factory_helper.faker = faker;

  let generateFiles = true;
  let persistFiles = true;
  if (buildOptions.generateFiles) generateFiles = ("generate" == buildOptions.generateFiles);
  if (buildOptions.persistFiles) persistFiles = ("persist" == buildOptions.persistFiles);

  let projectShortName = unsetProjectName;
  if (buildOptions.projectShortName) if (unsetProjectName != buildOptions.projectShortName) projectShortName = buildOptions.projectShortName;

  let listsPool = (buildOptions.pipeline) ? 
    (buildOptions.pipeline.lists) ? buildOptions.pipeline.lists : null :
    (buildOptions.listsPool) ? buildOptions.listsPool : null;
  const doctypes = listsPool.filter(listEntry => "doctype" === listEntry.type);
  const authors = listsPool.filter(listEntry => "author" === listEntry.type);
  const labels = listsPool.filter(listEntry => "label" === listEntry.type);
  const projectPhases = listsPool.filter(listEntry => "projectPhase" === listEntry.type);

  let author = factory_helper.generateFakePerson();
  let updator = faker.random.arrayElement([null, author, factory_helper.generateFakePerson()]);
  let deletor = faker.random.arrayElement([null, author, updator, factory_helper.generateFakePerson()]);

  let datePosted = moment(faker.date.past(10, new Date()));
  let updatedDate = (null == updator) ? null : datePosted.clone().subtract(faker.random.number(45), 'days');
  let dateUploaded = (null == updator) ? datePosted.clone().subtract(faker.random.number(15), 'days') : updatedDate.clone().subtract(faker.random.number(15), 'days');
  let createdDate = dateUploaded.clone().subtract(faker.random.number(15), 'days');

  let onlyUsePDFs = generateFiles;
  let docTypeSettings = (onlyUsePDFs) ? { ext: "pdf", mime: "application/pdf" } : docProps. faker.random.arrayElement(docProps);
  let displayName = factory.seq('Document.displayName', (n) => `Test Document ${n}`);

  let minioFileSystemFileName = faker.random.number({min:999999999999, max:10000000000000}) + "_" + (faker.random.alphaNumeric(60)).toLowerCase() + "." + docTypeSettings.ext;

  let numberOfLabels = faker.random.number(5);
  let distinctLabelsForThisDoc = [];
  for (let i = 0; i < numberOfLabels, i++;) {
    let label = factory_helper.getRandomExistingListElementName(labels);
    if (distinctLabelsForThisDoc[label]) continue;
    distinctLabelsForThisDoc.push(label);
  }
  

  let attrs = {
      _id              : factory_helper.ObjectId()

    , project          : factory_helper.ObjectId()

    // Tracking
    , _comment         : factory_helper.ObjectId()
    , _createdDate     : createdDate
    , _updatedDate     : updatedDate
    , _addedBy         : author.idir
    , _updatedBy       : (null == updator) ? null : updator.idir
    , _deletedBy       : (null == deletor) ? null : deletor.idir

    // Note: Default on tag property is purely for display only, they have no real effect on the model
    // This must be done in the code.
    , read             : ["public", "project-admin", "project-intake", "project-team", "project-system-admin"]
    , write            : ["project-admin", "project-intake", "project-team", "project-system-admin"]
    , delete           : ["project-admin", "project-intake", "project-team", "project-system-admin"]

    // Not editable
    , documentFileName : faker.lorem.sentence().replace(/\.$/g, '') + "." + docTypeSettings.ext
    , internalOriginalName : minioFileSystemFileName
    , internalURL      : "etl/" + projectShortName + "/" + minioFileSystemFileName
    , internalExt      : docTypeSettings.ext
    , internalSize     : faker.random.number({min:20000, max:250000000})  // staff upload some big docx's and pptx's
    , passedAVCheck    : (faker.random.number(100) < 5)  // 5% fail
    , internalMime     : docTypeSettings.mime

    // META
    , documentSource   : faker.random.arrayElement(["COMMENT", "DROPZONE", "PROJECT"])

    // Pre-filled with documentFileName in the UI
    , displayName      : displayName
    , milestone        : faker.random.arrayElement([null, factory_helper.ObjectId()])
    , dateUploaded     : dateUploaded
    , datePosted       : datePosted
    , type             : factory_helper.ObjectId(factory_helper.getRandomExistingMongoId(doctypes))
    , description      : faker.lorem.sentence()
    , documentAuthor   : author.fullName
    , documentAuthorType   : factory_helper.ObjectId(factory_helper.getRandomExistingMongoId(authors))
    , projectPhase     : factory_helper.ObjectId(factory_helper.getRandomExistingMongoId(projectPhases))
    , eaoStatus        : faker.random.arrayElement(["", "Published", "Rejected"])
    , keywords         : ""
    , labels           : distinctLabelsForThisDoc
  };

  let templatePath = faker.random.arrayElement([factory_helper.generatedDocSamples.S, factory_helper.generatedDocSamples.M, factory_helper.generatedDocSamples.L]); 
  let stats = fs.statSync(templatePath);

  attrs.internalSize = stats["size"];
  attrs.internalOriginalName = attrs.documentFileName;
  attrs.displayName = attrs.documentFileName;
  attrs.passedAVCheck = true;
  
  if (generateFiles) {
    let guid = faker.random.number({min:1000000000000000000, max:9999999999999999999}).toString()  // eg. 6628723481510936576
    let tempFilePath = uploadDir + guid + "." + docTypeSettings.ext;
    fs.copyFileSync(templatePath, tempFilePath);
    MinioController
    .putDocument(MinioController.BUCKETS.DOCUMENTS_BUCKET, attrs.project, attrs.documentFileName, tempFilePath)
    .then(async function (minioFile) {
      attrs.internalURL = minioFile.path;
    })
    .catch(function () {
      return attrs;
    })
    .finally(function(){
      // remove file from temp folder
      if (!persistFiles) fs.unlinkSync(tempFilePath, () => {});
    });
  }
  return attrs;
});

exports.factory = factory;
exports.name = factoryName;
exports.unsetProjectName = unsetProjectName;
exports.MinioControllerBucket = MinioController.BUCKETS.DOCUMENTS_BUCKET;
