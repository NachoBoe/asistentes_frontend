import React, { useState, useEffect, useRef, useMemo } from 'react';
import './App.css';
import { RemoteRunnable } from "@langchain/core/runnables/remote";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import '@fortawesome/fontawesome-free/css/all.min.css';
import initialFrases from './initialFrases.json';


type InitialFrasesKeys = keyof typeof initialFrases;

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


const url_str = import.meta.env.VITE_ASISTENTES_URL;
let globalUsername = '';
console.log(globalUsername)
const sendFeedback = async (
  feedbackText: string,
  button: HTMLElement,
  isPositive: boolean,
  tabId: string,
  endpoint: string,
  chatHistory: (HumanMessage | AIMessage)[],
  responseMessage: string
) => {
  const feedbackOptions = button.closest(".feedback-options") as HTMLElement;
  if (feedbackOptions) {
    feedbackOptions.style.display = "none";
  }
  const feedbackContainer = document.querySelector(".feedback-container");
  if (feedbackContainer) {
    feedbackContainer.remove();
  }
  console.log(tabId)
  try {
    const responseIndex = chatHistory.findIndex((msg) => msg.text === responseMessage);

    if (responseIndex === -1) {
      console.error("Response message not found in chat history.");
      return;
    }

    const previousMessages = chatHistory.slice(0, responseIndex);
    const previousUserMessage = chatHistory[responseIndex - 1]?.text || "N/A";

    const body = {
      isPositive: isPositive ? "positive" : "negative",
      comentario: feedbackText,
      mensaje: previousUserMessage,
      respuesta: responseMessage,
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

  if (!options) {
    console.error("Feedback options element not found. Check DOM structure.");
    return;
  }

  const feedbackContainer = document.querySelector(".feedback-container");

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
const Login = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const response = await fetch("https://support.dlya.com.uy/SGRAPI/rest/loginCentroDeSoporte", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Login: username,
          Pass: password,
        }),
      });

      const data = await response.json();

      if (data.Res === "S") {
        globalUsername = username;
        onLoginSuccess();
      } else {
        setErrorMessage("Incorrect username or password.");
      }
    } catch (error) {
      setErrorMessage("An error occurred during login. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
      {errorMessage && <p className="error-message">{errorMessage}</p>}
    </div>
  );
};
const showFeedbackBox = (
  button: HTMLElement,
  shouldCloseFeedback: React.MutableRefObject<boolean>,
  tabId: string,
  endpoint: string,
  chatHistory: (HumanMessage | AIMessage)[],
  responseMessage: string
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
        responseMessage
      );
      feedbackContainer.remove();
      (button.parentNode as HTMLElement).style.display = "none";
    }
  });

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

const processChunk = (chunk: any) => {
  if (chunk.event === 'on_chat_model_stream') {
    return chunk.data.chunk.content;
  }
  return '';
};

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState<JSX.Element[]>([]);
  const [awaitingResponse, setAwaitingResponse] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  
  const endpoints: string[] = import.meta.env.VITE_APP_ENDPOINTS.split(",");
  const uploadEndpoints: string[] = import.meta.env.VITE_APP_UPLOADENDPOINTS.split(",");
  // const initialFrasesArray: string[] = import.meta.env.VITE_APP_INITIALFRASES.split(",");

  // // Convertimos el array en un objeto clave-valor
  // const initialFrases: { [key: string]: string } = initialFrasesArray.reduce((acc, item) => {
  //   const [key, value] = item.split(":");
  //   acc[key.trim()] = value.trim();
  //   return acc;
  // }, {} as { [key: string]: string });


  // const endpoints: string[] = window.__RUNTIME_CONFIG__.VITE_APP_ENDPOINTS.split(",");
  const [endpoint, setEndpoint] = useState(endpoints[0]);
  
  const remoteChain = useMemo(() => new RemoteRunnable({
    url: `${url_str}/${endpoint}`,
  }), [endpoint]);

    const handleNewChat = async (param?: string | Event) => {
      let currentEndpoint = endpoint; // Valor por defecto
    
      if (typeof param === 'string') {
        // Si 'param' es un string, es el 'currentEndpoint' proporcionado
        currentEndpoint = param;
      } else if (param && typeof param === 'object' && 'preventDefault' in param) {
        // Si 'param' es un evento, podemos prevenir el comportamiento predeterminado si es necesario
        // param.preventDefault();
      }
    
    try {
      // Replace 'userId' with the actual user ID variable if you have it
      const userId = tabId;  // Adjust this to retrieve the actual user ID
      
      const formData = new FormData();
      formData.append('userId', userId);
  
      const response = await fetch(url_str + '/delete_files', {
        method: 'DELETE',
        body: formData,
      });
  
      if (response.ok) {
        console.log("All files have been successfully deleted.");
      } else {
        console.error("Failed to delete files:", await response.json());
      }
  
      // Clear the chat history after deleting the files
      setChat([]);
      chatHistory.current = [];
  
    } catch (error) {
      console.error("Error while deleting files:", error);
    }
    const key: InitialFrasesKeys = currentEndpoint as InitialFrasesKeys;
    const init_text: string = initialFrases[key];
    const initMessage = (
      <div className="message-container agent" key={Date.now()}>
        <img src="static/minilogo.png" alt="Avatar" className="avatar" />
        <div className="message">
          <div>{init_text}</div>
        </div>
      </div>
    );
    setChat((prevChat) => [...prevChat, initMessage]);
    chatHistory.current.push(new AIMessage(init_text));    
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
    let newEndpoint = endpoint; // Variable para almacenar el nuevo endpoint
    for (const endpoint of endpoints) {
      if (selectedVersion === endpoint) {
        newEndpoint = endpoint;
        setEndpoint(endpoint);
        break;
      }
    }
    handleNewChat(newEndpoint);
  };
  // Handler for file upload
  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      const allowedExtensions = ['pdf', 'docx', 'odt'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        const errorMessage = (
          <div className="message-container agent" key={Date.now()}>
            <img src="static/minilogo.png" alt="Avatar" className="avatar" />
            <div className="message">
              <div>Solo se permiten archivos PDF, DOCX, y ODT.</div>
            </div>
          </div>
        );
        setChat((prevChat) => [...prevChat, errorMessage]);

        return;
      }
  
  
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', tabId);
  
      try {
        const response = await fetch(url_str + '/upload', {
          method: 'POST',
          body: formData,
        });
  
        if (!response.ok) {
          const serverError = await response.json();
          const error_text: string = `Error al subir el archivo: ${serverError.message}`;
          const errorMessage = (
            <div className="message-container agent" key={Date.now()}>
              <img src="static/minilogo.png" alt="Avatar" className="avatar" />
              <div className="message">
                <div>{error_text}</div>
              </div>
            </div>
          );
          setChat((prevChat) => [...prevChat, errorMessage]);
          chatHistory.current.push(new AIMessage(error_text));

        } else {
          const success_text: string = `El documento ${file.name} fue agregado correctamente`;
          const successMessage = (
            <div className="message-container agent" key={Date.now()}>
              <img src="static/minilogo.png" alt="Avatar" className="avatar" />
              <div className="message">
                <div>{success_text}</div>
              </div>
            </div>
          );
          setChat((prevChat) => [...prevChat, successMessage]);
          chatHistory.current.push(new AIMessage(success_text));

        }
      } catch (error) {        
        // Type guard to check if error has a 'message' property
        const error_text_2: string = `Error al subir el archivo: ${(error as Error).message}`;
        const errorMessage = (
          <div className="message-container agent" key={Date.now()}>
            <img src="static/minilogo.png" alt="Avatar" className="avatar" />
            <div className="message">
              <div>{error_text_2}</div>
            </div>
          </div>
        );
        setChat((prevChat) => [...prevChat, errorMessage]);
        chatHistory.current.push(new AIMessage(error_text_2));
      }
      fileInputRef.current!.value = '';
    }
  };
  


  
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
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

      const logStream = await remoteChain.streamEvents(
        {
          input: message,
          chat_history: chatHistory.current,
        },
        {
          version: "v1",
          configurable: {
            user_id: tabId,
          },
          metadata: {
          },
        }
      );

      let fullMessage = "";
      let messageContainerKey = "";

      for await (const chunk of logStream) {
        const processedContent = processChunk(chunk);
        if (processedContent) {
          fullMessage += chunkProcess(processedContent);
          fullMessage = processMsg(fullMessage);

          if (!messageContainerKey) {
            messageContainerKey = Date.now().toString();
            setChat((prevChat) => [
              ...prevChat,
              createAgentMessage(fullMessage, messageContainerKey),
            ]);
          } else {
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
      chatHistory.current.push(new HumanMessage(message));
      chatHistory.current.push(new AIMessage(fullMessage));
      startMessageInput();
    } catch (error) {
      console.error("Error:", error);
      startMessageInput();
    }
  };

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
    handleAdjustHeight();

    return () => {
      window.removeEventListener('resize', handleAdjustHeight);
    };
  }, []);

  if (!isLoggedIn) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', width:'100vw' }}>
        <Login onLoginSuccess={() => setIsLoggedIn(true)} />
      </div>
    );  
  }

  return (
    <div id="content">
      <div className="top-section">
        <div className="header">
        <button id="newChatButton" onClick={() => handleNewChat()}>+</button>
        <h2><img src="static/logoBT.png" alt="Bantotal Logo" width="300" height="auto" /></h2>
          <div className="select-container">
            <select id="versionSelect" onChange={selectVersion} className="select-with-icons">
              {endpoints.map((endpoint) => (
                <option key={endpoint} value={endpoint}>
                  {endpoint.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </option>
              ))}
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
        <div
          id="uploadButton"
          onClick={uploadEndpoints.includes(endpoint) ? triggerFileUpload : undefined}
          className={uploadEndpoints.includes(endpoint) ? "enabled-button" : "disabled-button"}
        >
          <i id="clipIcon" className="clipIcon"></i>
        </div>
        <div id="sendButton" onClick={sendMessage}>
          <i id="sendIcon" className="sendIcon"></i>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
};

export default App;

