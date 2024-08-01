import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import { RemoteRunnable } from "@langchain/core/runnables/remote";
import { HumanMessage, AIMessage } from "@langchain/core/messages";

const adjustHeight = (messageRef: React.RefObject<HTMLTextAreaElement>) => {
  if (messageRef.current) {
    messageRef.current.style.height = 'auto';
    messageRef.current.style.height = (messageRef.current.scrollHeight + 10) + 'px';
  }
};

const escapeHTML = (text: string) => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
};

const url_str = "http://127.0.0.1:8000";

const sendFeedback = async (
  feedbackText: string,
  button: HTMLElement,
  isPositive: boolean,
  tabId: string,
  endpoint: string,
  chatHistory: (HumanMessage | AIMessage)[],
  responseMessage: string // Parameter for the current AI message
) => {
  // Immediately hide the feedback menu before sending the request
  const feedbackOptions = button.closest(".feedback-options") as HTMLElement;
  if (feedbackOptions) {
    feedbackOptions.style.display = "none";
  }
  const feedbackContainer = document.querySelector(".feedback-container");
  if (feedbackContainer) {
    feedbackContainer.remove();
  }

  try {
    // Find the index of the responseMessage in the chatHistory
    const responseIndex = chatHistory.findIndex((msg) => msg.text === responseMessage);

    if (responseIndex === -1) {
      console.error("Response message not found in chat history.");
      return;
    }

    // Get all messages prior to the response message for chatHistory
    const previousMessages = chatHistory.slice(0, responseIndex);

    // Get the message immediately preceding the response message
    const previousUserMessage = chatHistory[responseIndex - 1]?.text || "N/A";

    const body = {
      isPositive: isPositive ? "positive" : "negative",
      comentario: feedbackText,
      mensaje: previousUserMessage, // Previous message before the response
      respuesta: responseMessage,   // The message which triggered the feedback
      historial: previousMessages.map((msg) => [
        msg instanceof HumanMessage ? "human" : "ai",
        msg.text,
      ]),
      endpoint: endpoint,
    };

    console.log(chatHistory);
    console.log(JSON.stringify(body));

    const response = await fetch(url_str + "/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error("Error:", error);
  }
};



const toggleFeedbackOptions = (
  button: HTMLElement,
  shouldCloseFeedback: React.MutableRefObject<boolean>
) => {
  const options = button.nextElementSibling as HTMLElement;

  // Check if options exist and log if not found
  if (!options) {
    console.error("Feedback options element not found. Check DOM structure.");
    return;
  }

  const feedbackContainer = document.querySelector(".feedback-container");

  // Toggle display of feedback options
  if (options.style.display === "block") {
    options.style.display = "none";
    if (feedbackContainer) {
      feedbackContainer.remove();
    }
    document.removeEventListener("click", (event) =>
      closeFeedbackAndMenu(event, shouldCloseFeedback)
    );
  } else {
    options.style.display = "block";
    setTimeout(() => {
      document.addEventListener("click", (event) =>
        closeFeedbackAndMenu(event, shouldCloseFeedback)
      );
    }, 0);
  }
};


const showFeedbackBox = (
  button: HTMLElement,
  shouldCloseFeedback: React.MutableRefObject<boolean>,
  tabId: string,
  endpoint: string,
  chatHistory: (HumanMessage | AIMessage)[],
  responseMessage: string // Added parameter for response message
) => {
  let existingFeedbackBox = document.querySelector(".feedback-container");
  if (existingFeedbackBox) {
    (existingFeedbackBox as HTMLElement).remove();
  }

  let feedbackContainer = document.createElement("div");
  feedbackContainer.classList.add("feedback-container");
  feedbackContainer.style.position = "absolute";
  feedbackContainer.style.width = "auto";
  feedbackContainer.style.height = "auto";
  feedbackContainer.style.zIndex = "1000";

  let feedbackBox = document.createElement("textarea");
  feedbackBox.classList.add("feedback-box");
  feedbackBox.placeholder = "Cuéntame más...";
  feedbackBox.style.width = "200px";
  feedbackBox.style.height = "100px";

  feedbackBox.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendFeedback(
        feedbackBox.value,
        button,
        false,
        tabId,
        endpoint,
        chatHistory,
        responseMessage // Pass responseMessage here
      );
      feedbackContainer.remove();
      (button.parentNode as HTMLElement).style.display = "none";
    }
  });

  // Evita que el menú se cierre al hacer clic en la caja de texto
  feedbackBox.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  feedbackContainer.appendChild(feedbackBox);
  document.body.appendChild(feedbackContainer);

  const rect = button.getBoundingClientRect();
  feedbackContainer.style.left = `${rect.left}px`;
  feedbackContainer.style.top = `${rect.bottom + window.scrollY}px`;

  feedbackBox.focus();

  shouldCloseFeedback.current = false;
  setTimeout(() => {
    shouldCloseFeedback.current = true;
  }, 0);

  setTimeout(() => {
    document.addEventListener("click", (event) =>
      closeFeedbackAndMenu(event, shouldCloseFeedback)
    );
  }, 0);
};


const closeFeedbackAndMenu = (event: MouseEvent, shouldCloseFeedback: React.MutableRefObject<boolean>) => {
  const feedbackOptions = document.querySelector('.feedback-options');
  const feedbackContainer = document.querySelector('.feedback-container');

  if (shouldCloseFeedback.current) {
    if (feedbackOptions && !feedbackOptions.contains(event.target as Node) && !(event.target as HTMLElement).classList.contains('feedback-button-menu')) {
      (feedbackOptions as HTMLElement).style.display = 'none';
    }

    if (feedbackContainer && !feedbackContainer.contains(event.target as Node)) {
      (feedbackContainer as HTMLElement).remove();
    }

    document.removeEventListener('click', (event) => closeFeedbackAndMenu(event, shouldCloseFeedback));
  }
};

// Nueva función para procesar chunks
const processChunk = (chunk: any) => {
  if (chunk.event === 'on_chat_model_stream') {
    return chunk.data.chunk.content;
  }
  return '';
};

const App: React.FC = () => {
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<JSX.Element[]>([]);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [endpoint, setEndpoint] = useState("APIdocs");
  const shouldCloseFeedback = useRef(true);
  const chatHistory = useRef<(HumanMessage | AIMessage)[]>([]);

  const tabId = useMemo(() => {
    let id = sessionStorage.getItem('tabId');
    if (!id) {
      id = Date.now().toString() + Math.random().toString();
      sessionStorage.setItem('tabId', id);
    }
    return id;
  }, []);

  const remoteChain = useMemo(() => new RemoteRunnable({
    url: `${url_str}/${endpoint}`,
  }), [endpoint]);

  const handleNewChat = async () => {
    setChat([]);
    chatHistory.current = [];
  };

  useEffect(() => {
    const newChatButton = document.getElementById('newChatButton');
    newChatButton?.addEventListener('click', handleNewChat);

    return () => {
      newChatButton?.removeEventListener('click', handleNewChat);
    };
  }, [tabId]);

  const selectVersion = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedVersion = event.target.value;
    if (selectedVersion === "APIdocs") {
      setEndpoint("APIdocs");
    } else if (selectedVersion === "migracion") {
      setEndpoint("migracion");
    } else if (selectedVersion === "core") {
      setEndpoint("core");
    } else if (selectedVersion === "capacitacion") {
      setEndpoint("capacitacion");
    } 
    handleNewChat(); // Reinicia el chat al cambiar la versión
  };

  const processMsg = (text: string) => {
    const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
    let processedText = text.replace(linkRegex, '<a href="$2" target="_blank">$1</a>')
            .replace(/####\s*(.+?)\n/g, '<h4>$1</h4>')
            .replace(/###\s*(.+?)\n/g, '<h3>$1</h3>')
            .replace(/##\s*(.+?)\n/g, '<h2>$1</h2>')
            .replace(/```json\n([\s\S]+?)\n```/g, '<pre><code class="json">$1</code></pre>')
            .replace(/```xml\n([\s\S]+?)\n```/g, '<pre><code class="xml">$1</code></pre>')
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    return processedText;
  };

  const chunkProcess = (text: string) => {
    return text.replace(/</g, '&lt;')
              .replace(/>/g, '&gt;')
              .replace(/\|\|/g, '<br>')
              .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
  };
  const sendMessage = async () => {
    if (awaitingResponse || !message.trim()) return;
  
    stopMessageInput();
  
    const userMessage = (
      <div className="message-container user" key={Date.now()}>
        <div className="message">{escapeHTML(message)}</div>
      </div>
    );
    setChat((prevChat) => [...prevChat, userMessage]);
  
    try {
      chatHistory.current.push(new HumanMessage(message));
  
      const logStream = await remoteChain.streamEvents(
        {
          input: message,
          chat_history: chatHistory.current,
        },
        {
          version: "v1",
          configurable: {
            llm: "openai_gpt_3_5_turbo",
          },
          metadata: {
            conversation_id: tabId,
          },
        }
      );
  
      let fullMessage = "";
      let messageContainerKey = ""; // Initialize with an empty string
  
      for await (const chunk of logStream) {
        const processedContent = processChunk(chunk);
        if (processedContent) {
          fullMessage += chunkProcess(processedContent);
          fullMessage = processMsg(fullMessage);
  
          if (!messageContainerKey) {
            // Generate a new key when creating the message
            messageContainerKey = Date.now().toString();
            // eslint-disable-next-line no-loop-func

            setChat((prevChat) => [
              ...prevChat,
              createAgentMessage(fullMessage, messageContainerKey),
            ]);
          } else {
            // eslint-disable-next-line no-loop-func
            setChat((prevChat) =>
              prevChat.map((message) =>
                message.key === messageContainerKey
                  ? createAgentMessage(fullMessage, messageContainerKey)
                  : message
              )
            );
          }
        }
      }
  
      chatHistory.current.push(new AIMessage(fullMessage));
      startMessageInput();
    } catch (error) {
      console.error("Error:", error);
      startMessageInput();
    }
  };
  
  // Adjust this function to use the messageContainerKey correctly
  const createAgentMessage = (fullMessage: string, key: string) => (
    <div className="message-container agent" key={key}>
      <img src="static/minilogo.png" alt="Avatar" className="avatar" />
      <div className="message">
        <div dangerouslySetInnerHTML={{ __html: fullMessage }}></div>
        <button
          className="feedback-button-menu"
          onClick={(e) => toggleFeedbackOptions(e.currentTarget as HTMLElement, shouldCloseFeedback)}
        >
          ⋮
        </button>
        <div className="feedback-options" style={{ display: 'none' }}>
          <span
            onClick={(e) =>
              sendFeedback(
                "Correcto",
                e.currentTarget as HTMLElement,
                true,
                tabId,
                endpoint,
                chatHistory.current,
                fullMessage
              )
            }
          >
            Correcto
          </span>
          <span
            onClick={(e) =>
              showFeedbackBox(
                e.currentTarget as HTMLElement,
                shouldCloseFeedback,
                tabId,
                endpoint,
                chatHistory.current,
                fullMessage
              )
            }
          >
            Incorrecto
          </span>
        </div>
      </div>
    </div>
  );  

  const stopMessageInput = () => {
    if (messageRef.current) {
      messageRef.current.value = '';
      messageRef.current.disabled = true;
      messageRef.current.focus();
    }
    setAwaitingResponse(true);
  };

  const startMessageInput = () => {
    if (messageRef.current) {
      messageRef.current.value = '';
      messageRef.current.disabled = false;
      messageRef.current.focus();
    }
    setAwaitingResponse(false);
  };

  useEffect(() => {
    const handleAdjustHeight = () => adjustHeight(messageRef);

    window.addEventListener('resize', handleAdjustHeight);
    handleAdjustHeight(); // Llamada inicial para ajustar la altura correctamente

    return () => {
      window.removeEventListener('resize', handleAdjustHeight);
    };
  }, []);

  return (
    <div id="content">
      <div className="top-section">
        <div className="header">
          <button id="newChatButton">+</button>
          <h2><img src="static/logoBT.png" alt="Bantotal Logo" width="300" height="auto" /></h2>
          <div className="select-container">
            <select id="versionSelect" onChange={selectVersion} className="select-with-icons">
              <option value="APIdocs" className="option-icon api-icon">API</option>
              <option value="core" className="option-icon core-icon">Core</option>
              <option value="migracion" className="option-icon migracion-icon">Migración</option>
              <option value="capacitacion" className="option-icon migracion-icon">Capacitación</option>
            </select>
          </div>
        </div>
      </div>
      <div id="chat">
        {chat}
      </div>
      <div id="message-container">
        <textarea
          id="message"
          rows={1}
          ref={messageRef}
          autoFocus
          onInput={() => adjustHeight(messageRef)}
          placeholder="Escribe tu pregunta..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div id="sendButton" onClick={sendMessage}>
          <i id="sendIcon" className="sendIcon"></i>
        </div>
      </div>
    </div>
  );
};

export default App;
