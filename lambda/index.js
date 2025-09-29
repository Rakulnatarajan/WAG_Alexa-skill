const Alexa = require('ask-sdk-core');
const axios = require('axios');

const BACKEND_URL = "https://alexa-backend-hzghfegxcthgc2dj.canadacentral-01.azurewebsites.net/alexa";

const ssmlEscape = (s = "") =>
  String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");

async function fetchLatest(userId){
  try {
    const res = await axios.get(`${BACKEND_URL}/${userId}/answer`);
    const content = res.data?.content;
    if (!content) return [];
    return typeof content === 'string' ? JSON.parse(content) : content;
  } catch (err) {
    console.error('fetchLatest error:', err.message);
    return [];
  }
}

const WalgreensAssistantIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
           Alexa.getIntentName(handlerInput.requestEnvelope) === 'WalgreensAssistantIntent';
  },
  async handle(handlerInput) {
    console.info("Running pharmacy assistant...");
    try {
      const prompt = Alexa.getSlotValue(handlerInput.requestEnvelope, 'question');
      if (!prompt) {
        return handlerInput.responseBuilder
          .speak('Sorry, I did not understand the question, please try again.')
          .reprompt('What is your question?')
          .getResponse();
      }

      const userId = handlerInput.requestEnvelope.context.System.user.userId;
      const sessionId = handlerInput.requestEnvelope.session.sessionId;

      console.log(`Running service with: {text: ${prompt}, userId: ${userId}, sessionId: ${sessionId}}`);

      await axios.post(`${BACKEND_URL}`, { text: prompt, userId, sessionId });

      console.info("Pharmacy assistant execution finished!");

      return handlerInput.responseBuilder
        .speak("Processing the request, I will notify you when it is done.")
        .getResponse();

    } catch (err) {
      console.error('Error processing the question:', err.response?.data || err.message);
      return handlerInput.responseBuilder
        .speak('There was an issue processing your request.')
        .getResponse();
    }
  }
};

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
  },
  async handle(handlerInput) {
    console.info("Skill started!");
    try {
      const userId = handlerInput.requestEnvelope.context.System.user.userId;
      const pendingAnswers = await fetchLatest(userId);
      console.log('pendingAnswers type:', typeof pendingAnswers, 'value:', pendingAnswers);

      if (Array.isArray(pendingAnswers) && pendingAnswers.length > 0) {
        let speakOutput = '<speak>For your question: "Which location had the most interstore transfer this year?" The answer is: ';
        pendingAnswers.forEach(answer => {
          speakOutput += `${ssmlEscape(answer)}. `;
        });
        speakOutput += 'If you want to make another question, please say: my question is ...</speak>';

        return handlerInput.responseBuilder
          .speak(speakOutput)
          .reprompt('You can ask another question.')
          .getResponse();
      }
    } catch (err) {
      console.error("Error calling pendingAnswers endpoint:", err.message);
    }

    const welcomeText = 'Welcome! Tell me your question saying: my question is, followed by your question.';
    return handlerInput.responseBuilder
      .speak(welcomeText)
      .reprompt(welcomeText)
      .getResponse();
  }
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(handlerInput) {
    const speakOutput = 'You can ask me a question by saying: my question is ...';

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
       || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak('Goodbye!')
      .getResponse();
  }
};

const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
  },
  handle(handlerInput) {
    const speakOutput = 'Sorry, I don\'t know about that. Please try again.';
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
  },
  handle(handlerInput) {
    console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error('~~~~ Error handled:', error.message, error.stack);
    return handlerInput.responseBuilder
      .speak('Sorry, I had trouble doing what you asked. Please try again.')
      .reprompt('Please try again.')
      .getResponse();
  }
};

exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    WalgreensAssistantIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withCustomUserAgent('sample/pharmacy-assistant/v1.0')
  .lambda();
