class PracticeEngine {
    async getQuestions({ subject, topic, subtopic, difficulity, difficulityBand, status, search, page, limit, userId }) {

    }
    async getQuestion({ questionId, userID }) {

    }
    async submitAnswer({ userId, questionId, answer, timeMs }) {

    }
    async getSpeedPercentile({ questionID, userTimeMs }) { }
    async toggleMarkForReview({ userId, questionId }) { }
    async getUserStats(userID) {

    }
    async getTopicTree(subject) { }




}




module.exports = new PracticeEngine()