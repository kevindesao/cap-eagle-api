/*
 * Pipeline class to pass along generated data such that it can be accessed as needed by factories requiring data
 * from previous stages, and so that each factory can pass along its results.
 */

class GeneratedData {
    constructor() {
        this.audit = null;
        this.lists = null;
        this.users = null;
        this.organizations = null;
        this.projects = null;
        this.projectDocuments = null;
        this.projectDocumentRecentActivities = null;
        this.commentPeriods = null;
        this.commentPeriodComments = null;
        this.commentPeriodDocuments = null;
        this.commentPeriodRecentActivities = null;
        this.groups = null;
    }
}

module.exports.GeneratedData = GeneratedData;
