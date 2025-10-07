/**
 * @module EmojiContentProcessor
 * @description Processes emoji shortcodes and converts them to accessible emoji representations
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";

export class EmojiContentProcessor extends ContentProcessorBase {
  // Logging configuration (within class scope)
  static LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  static DEFAULT_LOG_LEVEL = EmojiContentProcessor.LOG_LEVELS.WARN;
  static ENABLE_ALL_LOGGING = false;
  static DISABLE_ALL_LOGGING = false;

  /**
   * Create a new EmojiContentProcessor instance
   */
  constructor() {
    super();

    // Initialise logging configuration for this instance
    this.currentLogLevel = EmojiContentProcessor.DEFAULT_LOG_LEVEL;
    this.allLoggingEnabled = EmojiContentProcessor.ENABLE_ALL_LOGGING;
    this.allLoggingDisabled = EmojiContentProcessor.DISABLE_ALL_LOGGING;

    this.logInfo("🚀 EmojiContentProcessor: Initialising emoji processor");

    // Set fallback map immediately
    this.emojiMap = this.getFallbackEmojiMap();

    // Add a flag to track if we're using fallback
    this.usingFallback = true;
    this.initialized = true; // Mark as initialised immediately with fallback

    this.logInfo(
      "🔄 EmojiContentProcessor: Starting async loading of emoji data file"
    );
    this.initializeAsync();

    this.utils.log(
      "Emoji content processor initialised with fallback emoji map"
    );
  }

  /**
   * Check if logging should occur for the given level
   * @param {number} level - The logging level to check
   * @returns {boolean} True if logging should occur
   */
  shouldLog(level) {
    if (this.allLoggingDisabled) return false;
    if (this.allLoggingEnabled) return true;
    return level <= this.currentLogLevel;
  }

  /**
   * Log an error message
   * @param {string} message - The message to log
   * @param {*} [data] - Optional data to log
   */
  logError(message, data = null) {
    if (this.shouldLog(EmojiContentProcessor.LOG_LEVELS.ERROR)) {
      if (data) {
        console.error(message, data);
      } else {
        console.error(message);
      }
    }
  }

  /**
   * Log a warning message
   * @param {string} message - The message to log
   * @param {*} [data] - Optional data to log
   */
  logWarn(message, data = null) {
    if (this.shouldLog(EmojiContentProcessor.LOG_LEVELS.WARN)) {
      if (data) {
        console.warn(message, data);
      } else {
        console.warn(message);
      }
    }
  }

  /**
   * Log an info message
   * @param {string} message - The message to log
   * @param {*} [data] - Optional data to log
   */
  logInfo(message, data = null) {
    if (this.shouldLog(EmojiContentProcessor.LOG_LEVELS.INFO)) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Log a debug message
   * @param {string} message - The message to log
   * @param {*} [data] - Optional data to log
   */
  logDebug(message, data = null) {
    if (this.shouldLog(EmojiContentProcessor.LOG_LEVELS.DEBUG)) {
      if (data) {
        console.log(message, data);
      } else {
        console.log(message);
      }
    }
  }

  /**
   * Initialize the emoji map asynchronously
   * This loads the emoji data from the JSON file
   */
  async initializeAsync() {
    try {
      this.logDebug(
        "🔍 EmojiContentProcessor: Starting to load emoji data from JSON file"
      );

      // Change the path to make it more likely to find the file
      const emojiPath = "/emoji-data.json"; // Try absolute path
      this.logDebug(
        `📂 EmojiContentProcessor: Attempting to load from: ${emojiPath}`
      );

      // Add logging before fetch to clearly track execution
      this.logDebug("🔄 EmojiContentProcessor: About to fetch emoji data...");

      // Fetch with explicit timeout and error handling
      const response = await fetch(emojiPath, {
        method: "GET",
        cache: "no-cache",
        timeout: 5000,
      });

      // Log response status
      this.logDebug(
        `📄 EmojiContentProcessor: Fetch response status: ${response.status}`
      );

      if (!response.ok) {
        this.logError(
          `❌ EmojiContentProcessor: Failed to load emoji data: ${response.status} ${response.statusText}`
        );
        throw new Error(
          `Failed to load emoji data: ${response.status} ${response.statusText}`
        );
      }

      this.logInfo(
        "✅ EmojiContentProcessor: Emoji data file fetched successfully, parsing JSON..."
      );
      const data = await response.json();

      // Extract metadata if it exists
      if (data.__meta) {
        const { version, lastUpdated, totalCount } = data.__meta;
        this.logInfo(
          `📊 EmojiContentProcessor: Emoji data loaded - Version: ${version}, Last Updated: ${lastUpdated}, Total Emojis: ${totalCount}`
        );
        this.utils.log("Emoji data loaded", {
          version,
          lastUpdated,
          totalCount,
        });
        this.usingFallback = false;
        this.initialized = true;
        // Remove metadata from the emoji map
        delete data.__meta;
      }

      // Merge with fallback to ensure we have all common emojis
      this.emojiMap = { ...this.getFallbackEmojiMap(), ...data };
      this.initialized = true;

      // Log the sample of loaded emojis
      const emojiCount = Object.keys(this.emojiMap).length;
      const sampleEmojis = Object.entries(this.emojiMap)
        .slice(0, 5)
        .map(([code, emoji]) => `${code}: ${emoji}`);
      this.logInfo(
        `🎉 EmojiContentProcessor: Successfully loaded ${emojiCount} emojis!`
      );
      this.logDebug(
        `📝 EmojiContentProcessor: Sample emojis: ${sampleEmojis.join(", ")}...`
      );

      this.utils.log("Emoji data loaded successfully", {
        mapSize: emojiCount,
      });
    } catch (error) {
      this.logError(
        `❌ EmojiContentProcessor: Error loading emoji data:`,
        error
      );
      this.utils.log("Error loading emoji data", { error }, "error");
      this.logWarn(
        "⚠️ EmojiContentProcessor: Using fallback emoji map due to load error"
      );
      // We already have the fallback emoji map from constructor
      this.initialized = true; // Mark as initialised so we can continue
    }
  }

  /**
   * Process emoji shortcodes in content
   * @param {string} content - Content to process
   * @returns {string} Processed content with emoji shortcodes converted to accessible emojis
   */
  process(content) {
    if (!content) return "";

    try {
      // Check if content has potential emoji shortcodes
      if (!content.includes(":")) {
        return content;
      }

      this.utils.log(
        `Processing emoji shortcodes (using ${
          this.usingFallback ? "fallback" : "loaded"
        } emoji map)`
      );
      this.logDebug(
        `🔍 EmojiContentProcessor: Processing with ${
          Object.keys(this.emojiMap).length
        } emojis in map`
      );

      // Direct string replacement approach
      return this.replaceEmojiShortcodes(content);
    } catch (error) {
      this.utils.log("Error processing emoji shortcodes", { error }, "error");
      return content;
    }
  }

  /**
   * Replace emoji shortcodes in content with accessible emoji spans
   * @param {string} content - Content to process
   * @returns {string} Processed content with emoji shortcodes converted
   */
  replaceEmojiShortcodes(content) {
    this.logDebug(
      `🔄 EmojiContentProcessor: Starting to process content for emoji shortcodes`
    );
    this.logDebug(
      `📋 EmojiContentProcessor: Content preview: ${content.substring(
        0,
        100
      )}...`
    );

    // Count total emoji shortcodes before processing
    const totalEmojiCount = (content.match(/:[a-z0-9_+-]+:/g) || []).length;
    this.logDebug(
      `🔢 EmojiContentProcessor: Found approximately ${totalEmojiCount} potential emoji shortcodes`
    );

    // More permissive regex that works even within HTML tags but not in attributes
    const shortcodeRegex = /(?<!="):([\w+-]+):/g;

    // Check if emojiMap is populated
    this.logDebug(
      `📊 EmojiContentProcessor: Emoji map has ${
        Object.keys(this.emojiMap).length
      } entries`
    );
    this.logDebug(
      `📝 EmojiContentProcessor: First few emojis: ${JSON.stringify(
        Object.entries(this.emojiMap).slice(0, 5)
      )}`
    );

    // Track processed shortcodes for logging
    const processed = new Set();
    const missing = new Set();

    // Log if some common emojis exist in the map
    const testEmojis = ["smile", "heart", "tada", "rocket"];
    testEmojis.forEach((code) => {
      this.logDebug(
        `🔍 Testing emoji '${code}': ${
          this.emojiMap[code] ? "Found ✅" : "Missing ❌"
        }`
      );
    });

    // Replace shortcodes
    const result = content.replace(shortcodeRegex, (match, shortcode) => {
      this.logDebug(`🔎 Found shortcode: ${shortcode}`);

      // Check if this shortcode exists in our map
      if (this.emojiMap[shortcode]) {
        const emoji = this.emojiMap[shortcode];
        processed.add(shortcode);

        // Create an accessible span with appropriate ARIA attributes
        return `<span role="img" aria-label="${shortcode}">${emoji}</span>`;
      }

      // Track missing shortcodes
      missing.add(shortcode);

      // If not found, return the original shortcode
      return match;
    });

    // Log what we processed
    if (processed.size > 0) {
      this.logInfo(
        `✅ EmojiContentProcessor: Converted ${
          processed.size
        } emoji shortcodes: ${Array.from(processed).slice(0, 5).join(", ")}${
          processed.size > 5 ? "..." : ""
        }`
      );
      this.utils.log(`Converted ${processed.size} emoji shortcodes`, {
        processedCodes:
          Array.from(processed).slice(0, 5).join(", ") +
          (processed.size > 5 ? "..." : ""),
      });
    } else {
      this.logInfo(
        `ℹ️ EmojiContentProcessor: No emoji shortcodes found or converted`
      );
    }

    // Log any missing shortcodes
    if (missing.size > 0) {
      this.logWarn(
        `⚠️ EmojiContentProcessor: ${
          missing.size
        } emoji shortcodes not found in emoji map: ${Array.from(missing)
          .slice(0, 10)
          .join(", ")}${missing.size > 10 ? "..." : ""}`
      );
      this.utils.log(
        `${missing.size} emoji shortcodes not found in emoji map`,
        {
          missingCodes:
            Array.from(missing).slice(0, 10).join(", ") +
            (missing.size > 10 ? "..." : ""),
        }
      );
    }

    return result;
  }

  /**
   * Get fallback emoji map with essential emojis
   * Used if the JSON file fails to load
   * @returns {Object} Map of emoji shortcodes to emoji characters
   */
  getFallbackEmojiMap() {
    this.utils.log("Using fallback emoji map");

    // Include common emojis as a fallback
    // This expanded list covers many common use cases
    return {
      // Smileys & Emotion
      smile: "😄",
      laughing: "😆",
      blush: "😊",
      smiley: "😃",
      relaxed: "☺️",
      smirk: "😏",
      heart_eyes: "😍",
      kissing_heart: "😘",
      kissing: "😗",
      confused: "😕",
      neutral_face: "😐",
      expressionless: "😑",
      unamused: "😒",
      sweat_smile: "😅",
      sweat: "😓",
      disappointed: "😞",
      weary: "😩",
      pensive: "😔",
      worried: "😟",
      angry: "😠",
      rage: "😡",
      cry: "😢",
      sob: "😭",
      joy: "😂",
      slightly_smiling_face: "🙂",
      upside_down_face: "🙃",
      thinking_face: "🤔",
      frowning: "😦",
      triumph: "😤",
      sunglasses: "😎",
      sleeping: "😴",
      yum: "😋",

      // Gestures & People
      thumbsup: "👍",
      "+1": "👍",
      thumbsdown: "👎",
      "-1": "👎",
      ok_hand: "👌",
      punch: "👊",
      fist: "✊",
      v: "✌️",
      wave: "👋",
      hand: "✋",
      raised_hand: "✋",
      pray: "🙏",
      clap: "👏",
      muscle: "💪",
      metal: "🤘",
      person_shrugging: "🤷",
      person_facepalming: "🤦",

      // Love & Hearts
      heart: "❤️",
      yellow_heart: "💛",
      green_heart: "💚",
      blue_heart: "💙",
      purple_heart: "💜",
      broken_heart: "💔",
      two_hearts: "💕",
      revolving_hearts: "💞",
      sparkling_heart: "💖",

      // Animals
      dog: "🐶",
      cat: "🐱",
      mouse: "🐭",
      hamster: "🐹",
      rabbit: "🐰",
      fox_face: "🦊",
      bear: "🐻",
      panda_face: "🐼",
      koala: "🐨",
      tiger: "🐯",
      lion: "🦁",
      cow: "🐮",
      pig: "🐷",
      frog: "🐸",
      monkey_face: "🐵",
      monkey: "🐒",
      chicken: "🐔",
      penguin: "🐧",
      bird: "🐦",
      baby_chick: "🐤",
      elephant: "🐘",
      snake: "🐍",
      dragon: "🐉",
      unicorn: "🦄",

      // Food & Drink
      apple: "🍎",
      green_apple: "🍏",
      pear: "🍐",
      tangerine: "🍊",
      lemon: "🍋",
      banana: "🍌",
      watermelon: "🍉",
      grapes: "🍇",
      strawberry: "🍓",
      peach: "🍑",
      cherries: "🍒",
      tomato: "🍅",
      eggplant: "🍆",
      avocado: "🥑",
      hamburger: "🍔",
      pizza: "🍕",
      hotdog: "🌭",
      taco: "🌮",
      sushi: "🍣",
      ice_cream: "🍦",
      cake: "🍰",
      cookie: "🍪",
      chocolate_bar: "🍫",
      candy: "🍬",
      lollipop: "🍭",
      coffee: "☕",
      tea: "🍵",
      beer: "🍺",
      wine_glass: "🍷",
      cocktail: "🍸",

      // Travel & Places
      rocket: "🚀",
      airplane: "✈️",
      helicopter: "🚁",
      car: "🚗",
      red_car: "🚗",
      blue_car: "🚙",
      bus: "🚌",
      truck: "🚚",
      boat: "⛵",
      sailboat: "⛵",
      motorcycle: "🏍️",
      bicycle: "🚲",
      train: "🚆",
      station: "🚉",
      house: "🏠",
      office: "🏢",
      hospital: "🏥",
      bank: "🏦",
      school: "🏫",
      hotel: "🏨",
      church: "⛪",
      tent: "⛺",
      stadium: "🏟️",
      tokyo_tower: "🗼",
      statue_of_liberty: "🗽",
      mountain: "⛰️",
      sunrise_over_mountains: "🌄",
      desert: "🏜️",
      beach_with_umbrella: "🏖️",
      rainbow: "🌈",
      city_sunset: "🌆",

      // Activities
      soccer: "⚽",
      basketball: "🏀",
      football: "🏈",
      baseball: "⚾",
      tennis: "🎾",
      bowling: "🎳",
      golf: "⛳",
      skiing: "🎿",
      snowboarder: "🏂",
      swimmer: "🏊",
      surfer: "🏄",
      fishing_pole_and_fish: "🎣",
      running: "🏃",
      dancer: "💃",
      microphone: "🎤",
      headphones: "🎧",
      musical_note: "🎵",
      guitar: "🎸",
      violin: "🎻",
      trumpet: "🎺",
      saxophone: "🎷",
      video_game: "🎮",
      alien: "👽",
      space_invader: "👾",
      robot: "🤖",

      // Objects
      watch: "⌚",
      iphone: "📱",
      calling: "📲",
      computer: "💻",
      keyboard: "⌨️",
      desktop: "🖥️",
      printer: "🖨️",
      mouse_three_button: "🖱️",
      trackball: "🖲️",
      joystick: "🕹️",
      camera: "📷",
      video_camera: "📹",
      movie_camera: "🎥",
      tv: "📺",
      radio: "📻",
      satellite: "📡",
      bulb: "💡",
      flashlight: "🔦",
      candle: "🕯️",
      wastebasket: "🗑️",
      lock: "🔒",
      key: "🔑",
      hammer: "🔨",
      gun: "🔫",
      bomb: "💣",
      hocho: "🔪",
      pill: "💊",
      syringe: "💉",
      book: "📖",
      books: "📚",
      newspaper: "📰",
      art: "🎨",
      briefcase: "💼",
      moneybag: "💰",
      dollar: "💵",
      credit_card: "💳",
      gem: "💎",
      wrench: "🔧",
      hammer_and_wrench: "🛠️",

      // Symbols
      white_check_mark: "✅",
      heavy_check_mark: "✔️",
      x: "❌",
      negative_squared_cross_mark: "❎",
      heavy_plus_sign: "➕",
      heavy_minus_sign: "➖",
      heavy_multiplication_x: "✖️",
      heavy_division_sign: "➗",
      infinity: "♾️",
      bangbang: "‼️",
      interrobang: "⁉️",
      question: "❓",
      exclamation: "❗",
      100: "💯",
      warning: "⚠️",
      fire: "🔥",
      star: "⭐",
      sparkles: "✨",
      dizzy: "💫",
      boom: "💥",
      star2: "🌟",
      zap: "⚡",
      snowflake: "❄️",
      rainbow: "🌈",
      sunny: "☀️",
      cloud: "☁️",
      umbrella: "☂️",
      eyes: "👀",
      ear: "👂",
      nose: "👃",
      lips: "👄",
      tongue: "👅",
      mouth: "👄",
      speech_balloon: "💬",
      thought_balloon: "💭",
      zzz: "💤",
      musical_score: "🎼",
    };
  }
}
