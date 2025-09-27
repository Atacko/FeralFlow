class E621Feed {
  constructor() {
    this.currentPage = 1
    this.currentTags = ""
    this.isLoading = false
    this.hasMorePosts = true
    this.posts = []
    this.observer = null
    this.lastPostId = null

    this.isAuthenticated = false
    this.username = null
    this.apiKey = null
    this.currentView = "feed"

    this.init()
  }

  init() {
    this.setupEventListeners()
    this.setupInfiniteScroll()
    this.loadInitialPosts()
    this.checkSavedAuth()
  }

  checkSavedAuth() {
    const savedAuth = localStorage.getItem("e621_auth")
    if (savedAuth) {
      try {
        const auth = JSON.parse(savedAuth)
        this.username = auth.username
        this.apiKey = auth.apiKey
        this.isAuthenticated = true
        console.log("User authenticated as:", this.username)
      } catch (error) {
        console.log("Invalid saved auth, clearing")
        localStorage.removeItem("e621_auth")
      }
    }
  }

  saveAuth(username, apiKey) {
    this.username = username
    this.apiKey = apiKey
    this.isAuthenticated = true
    localStorage.setItem("e621_auth", JSON.stringify({ username, apiKey }))
  }

  logout() {
    this.username = null
    this.apiKey = null
    this.isAuthenticated = false
    localStorage.removeItem("e621_auth")
    this.showFeed()
  }

  async authenticateUser(username, apiKey) {
    try {
      if (!username || !apiKey || username.trim() === "" || apiKey.trim() === "") {
        return false
      }

      if (apiKey.length < 20) {
        return false
      }

      this.saveAuth(username.trim(), apiKey.trim())
      return true
    } catch (error) {
      console.error("Authentication error:", error)
      return false
    }
  }

  async addToFavorites(postId) {
    if (!this.isAuthenticated) {
      alert("Please log in to add favorites")
      return false
    }

    try {
      const favoriteUrl = `https://e621.net/favorites.json`

      const response = await fetch(favoriteUrl, {
        method: "POST",
        headers: {
          "User-Agent": "E621Feed/1.0 (by " + this.username + " on e621)",
          Authorization: "Basic " + btoa(this.username + ":" + this.apiKey),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: `post_id=${postId}`,
      })

      if (response.ok) {
        return true
      } else if (response.status === 401) {
        alert("Authentication failed. Please check your login credentials.")
        this.logout()
        return false
      } else {
        console.error("Favorites API error:", response.status)
        return false
      }
    } catch (error) {
      console.error("Error adding to favorites:", error)
      return true
    }
  }

  async removeFromFavorites(postId) {
    if (!this.isAuthenticated) {
      alert("Please log in to manage favorites")
      return false
    }

    try {
      const favoriteUrl = `https://e621.net/favorites/${postId}.json`

      const response = await fetch(favoriteUrl, {
        method: "DELETE",
        headers: {
          "User-Agent": "E621Feed/1.0 (by " + this.username + " on e621)",
          Authorization: "Basic " + btoa(this.username + ":" + this.apiKey),
        },
      })

      if (response.ok) {
        return true
      } else if (response.status === 401) {
        alert("Authentication failed. Please check your login credentials.")
        this.logout()
        return false
      } else if (response.status === 404) {
        return true
      } else {
        console.error("Remove favorites API error:", response.status)
        return false
      }
    } catch (error) {
      console.error("Error removing from favorites:", error)
      return true
    }
  }

  setupEventListeners() {
    const searchInput = document.getElementById("searchInput")
    const searchBtn = document.getElementById("searchBtn")

    // Search functionality
    searchBtn.addEventListener("click", () => this.handleSearch())
    searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleSearch()
      }
    })

    // Navigation
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => this.handleNavigation(e))
    })

    // Post interactions
    document.addEventListener("click", (e) => {
      if (e.target.closest(".engagement-item")) {
        this.handleEngagement(e)
      }
    })
  }

  setupInfiniteScroll() {
    const loadMoreTrigger = document.getElementById("loadMoreTrigger")

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.isLoading) {
            console.log("Infinite scroll triggered")
            this.loadMorePosts()
          }
        })
      },
      {
        rootMargin: "100px",
      },
    )

    this.observer.observe(loadMoreTrigger)
  }

  async handleSearch() {
    const searchInput = document.getElementById("searchInput")
    const tags = searchInput.value.trim()

    if (tags === this.currentTags) return

    this.currentTags = tags
    this.posts = []
    this.currentPage = 1
    this.isLoading = false
    this.hasMorePosts = true

    const feed = document.getElementById("feed")
    feed.innerHTML =
      '<div class="loading-indicator" id="loadingIndicator"><div class="spinner"></div><p>Searching posts...</p></div>'

    if (this.observer) {
      this.observer.disconnect()
    }

    await this.loadPosts()
  }

  async loadInitialPosts() {
    this.currentTags = "female"
    this.currentPage = 1
    await this.loadPosts()
  }

  async loadMorePosts() {
    if (this.isLoading) return

    console.log("Loading more posts...")
    console.log("Current page:", this.currentPage)
    console.log("Current tags:", this.currentTags)

    if (!this.currentTags) {
      console.log("No current tags set, using default")
      this.currentTags = "female"
    }

    this.currentPage++
    console.log("Incremented page to:", this.currentPage)

    await this.loadPosts()
  }

  async loadPosts() {
    if (this.isLoading) return

    this.isLoading = true
    this.showLoading()

    try {
      console.log("Loading posts for tags:", this.currentTags, "page:", this.currentPage)

      const tagsToUse = this.currentTags || "female"
      console.log("Using tags:", tagsToUse)

      const posts = await this.fetchE621Posts(tagsToUse, this.currentPage)

      console.log("Received posts:", posts.length)

      if (posts.length === 0) {
        console.log("No posts found for page", this.currentPage)

        if (this.currentPage > 1) {
          console.log("Resetting to page 1 for endless scroll")
          this.currentPage = 1
          const resetPosts = await this.fetchE621Posts(tagsToUse, 1)
          if (resetPosts.length > 0) {
            console.log("Reset successful, got", resetPosts.length, "posts")
            this.posts = [...this.posts, ...resetPosts]
            this.renderNewPosts(resetPosts)
          }
        }
      } else {
        if (this.currentPage === 1 && this.posts.length === 0) {
          console.log("First page, replacing all posts")
          this.posts = posts
          this.renderPosts()
        } else {
          console.log("Additional page, appending", posts.length, "posts")
          this.posts = [...this.posts, ...posts]
          this.renderNewPosts(posts)
        }
      }

      console.log("Total posts loaded:", this.posts.length)
    } catch (error) {
      console.error("Error loading posts:", error)
    } finally {
      this.isLoading = false
      this.hideLoading()
    }
  }

  async fetchE621Posts(tags, page = 1) {
    const baseUrl = "https://e621.net/posts.json"
    const params = new URLSearchParams({
      tags: tags || "female",
      limit: 20,
      page: page.toString(),
    })

    try {
      console.log("Fetching posts with URL:", baseUrl + "?" + params.toString())

      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(baseUrl + "?" + params.toString())}`

      const response = await fetch(proxyUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const e621Data = JSON.parse(data.contents)

      console.log("API Response received, posts count:", e621Data?.posts?.length || 0)

      if (e621Data && e621Data.posts) {
        const posts = e621Data.posts

        console.log("Posts available:", posts.length)

        return posts
          .map((post) => ({
            id: post.id,
            file: {
              url: post.file?.url,
              ext: post.file?.ext || "jpg",
            },
            preview: {
              url: post.preview?.url,
            },
            tags: {
              general: post.tags?.general || [],
              species: post.tags?.species || [],
              character: post.tags?.character || [],
              artist: post.tags?.artist || [],
            },
            score: {
              up: post.score?.up || 0,
              down: post.score?.down || 0,
              total: post.score?.total || 0,
            },
            fav_count: post.fav_count || 0,
            comment_count: post.comment_count || 0,
            created_at: post.created_at,
            rating: post.rating || "s",
            description: post.description || "",
            uploader_id: post.uploader_id,
            uploader_name: post.uploader_name || "Anonymous",
          }))
          .filter((post) => post.file.url)
      } else {
        throw new Error("Invalid API response format")
      }
    } catch (error) {
      console.error("API Error:", error)

      if (error.message.includes("HTTP error")) {
        throw new Error("Failed to connect to e621. Please check your internet connection.")
      } else if (error.message.includes("Invalid API response")) {
        throw new Error("Received invalid data from e621. Please try again.")
      } else {
        throw new Error("Unable to load posts from e621. Please try again later.")
      }
    }
  }

  async fetchUserProfile(userId) {
    if (!userId) return null

    try {
      const userUrl = `https://e621.net/users/${userId}.json`
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(userUrl)}`

      const response = await fetch(proxyUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      const userData = JSON.parse(data.contents)

      return userData.avatar_id || null
    } catch (error) {
      console.log("Could not fetch user profile:", error)
      return null
    }
  }

  async getProfilePictureUrl(post) {
    if (!post.uploader_id) {
      return null
    }

    try {
      const avatarId = await this.fetchUserProfile(post.uploader_id)
      if (avatarId) {
        const avatarUrl = `https://e621.net/posts/${avatarId}.json`
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(avatarUrl)}`

        const response = await fetch(proxyUrl)
        if (response.ok) {
          const data = await response.json()
          const avatarData = JSON.parse(data.contents)
          return avatarData.post?.preview?.url || null
        }
      }
    } catch (error) {
      console.log("Could not fetch avatar:", error)
    }

    return null
  }

  renderNewPosts(newPosts) {
    const feed = document.getElementById("feed")
    let loadMoreTrigger = document.getElementById("loadMoreTrigger")

    console.log("Rendering", newPosts.length, "new posts")

    newPosts.forEach((post, index) => {
      const postElement = this.createPostElement(post)
      postElement.classList.add("post-enter")
      postElement.style.animationDelay = `${index * 0.1}s`

      if (loadMoreTrigger) {
        feed.insertBefore(postElement, loadMoreTrigger)
      } else {
        feed.appendChild(postElement)
      }
    })

    if (!loadMoreTrigger) {
      loadMoreTrigger = document.createElement("div")
      loadMoreTrigger.id = "loadMoreTrigger"
      loadMoreTrigger.style.height = "20px"
      loadMoreTrigger.style.visibility = "hidden"
      feed.appendChild(loadMoreTrigger)

      if (this.observer) {
        this.observer.observe(loadMoreTrigger)
      }
    } else {
      feed.appendChild(loadMoreTrigger)
    }
  }

  renderPosts() {
    const feed = document.getElementById("feed")

    if (this.currentPage === 1) {
      feed.innerHTML = ""
    }

    const existingPostCount = feed.querySelectorAll(".post").length
    const newPosts = this.posts.slice(existingPostCount)

    console.log("Rendering", newPosts.length, "new posts")

    newPosts.forEach((post, index) => {
      const postElement = this.createPostElement(post)
      postElement.classList.add("post-enter")
      postElement.style.animationDelay = `${index * 0.1}s`
      feed.appendChild(postElement)
    })

    let loadMoreTrigger = document.getElementById("loadMoreTrigger")
    if (!loadMoreTrigger) {
      loadMoreTrigger = document.createElement("div")
      loadMoreTrigger.id = "loadMoreTrigger"
      loadMoreTrigger.style.height = "20px"
      loadMoreTrigger.style.visibility = "hidden"
    }
    feed.appendChild(loadMoreTrigger)

    if (this.observer) {
      this.observer.disconnect()
      this.observer.observe(loadMoreTrigger)
      console.log("Observer reconnected to trigger element")
    }
  }

  createPostElement(post) {
    const postDiv = document.createElement("div")
    postDiv.className = "post"
    postDiv.dataset.postId = post.id

    const allTags = [
      ...post.tags.general.slice(0, 4),
      ...post.tags.species.slice(0, 2),
      ...post.tags.character.slice(0, 2),
    ].slice(0, 8)

    const timeAgo = this.getTimeAgo(new Date(post.created_at))
    const rating = this.getRatingText(post.rating)

    const artistName = post.tags.artist.length > 0 ? post.tags.artist[0].replace(/_/g, " ") : `Artist_${post.id}`

    const postText =
      post.description && post.description.trim()
        ? post.description.trim()
        : `Post #${post.id}${post.tags.species.length > 0 ? ` - ${post.tags.species.join(", ")}` : ""}`

    const profileImageHtml = `
      <div class="profile-pic">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
        </svg>
      </div>
    `

    const isVideo = post.file.ext === "webm" || post.file.ext === "mp4"
    const mediaElement = isVideo
      ? `<video src="${post.file.url}" class="post-image" loading="lazy" controls loop muted autoplay></video>`
      : `<img src="${post.file.url}" alt="Post image" class="post-image" loading="lazy">`

    postDiv.innerHTML = `
      <div class="post-header">
        ${profileImageHtml}
        <div class="post-info">
          <div class="user-info">
            <span class="username">${artistName}</span>
            <span class="user-handle">@${artistName.toLowerCase().replace(/\s+/g, "")}</span>
            <span class="post-time">${timeAgo}</span>
          </div>
        </div>
      </div>
      
      <div class="post-content">
        <div class="post-text">${postText}</div>
        
        <div class="post-tags">
          ${allTags.map((tag) => `<a href="#" class="tag" data-tag="${tag}" onclick="event.preventDefault(); document.getElementById('searchInput').value='${tag}'; document.getElementById('searchBtn').click();">#${tag.replace(/_/g, " ")}</a>`).join("")}
        </div>
        
        <div class="post-media">
          ${mediaElement}
          <div class="image-overlay">
            <span class="rating-badge">${rating}</span>
          </div>
        </div>
      </div>
      
      <div class="engagement-bar">
        <div class="engagement-item" data-type="reply">
          <svg class="engagement-icon" viewBox="0 0 24 24">
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46L18.5 16.45V8c0-1.1-.896-2-2-2z"/>
          </svg>
          <span>${post.comment_count}</span>
        </div>
        
        <div class="engagement-item" data-type="retweet">
          <svg class="engagement-icon" viewBox="0 0 24 24">
            <path d="M4.5 3.88l4.432 4.14-1.364 1.46L5.5 7.55V16c0 1.1.896 2 2 2H13v2H7.5c-2.209 0-4-1.79-4-4V7.55L1.432 9.48.068 8.02 4.5 3.88zM16.5 6H11V4h5.5c2.209 0 4 1.79 4 4v8.45l2.068-1.93 1.364 1.46-4.432 4.14-4.432-4.14 1.364-1.46L18.5 16.45V8c0-1.1-.896-2-2-2z"/>
          </svg>
          <span>${Math.floor(post.score.total * 0.1) || 0}</span>
        </div>
        
        <div class="engagement-item" data-type="like" data-post-id="${post.id}">
          <svg class="engagement-icon" viewBox="0 0 24 24">
            <path d="M12 21.638h-.014C9.403 21.59 1.95 14.856 1.95 8.478c0-3.064 2.525-5.754 5.403-5.754 2.29 0 3.83 1.58 4.646 2.73.814-1.148 2.354-2.73 4.645-2.73 2.88 0 5.404 2.69 5.404 5.755 0 6.376-7.454 13.11-10.037 13.157H12zM7.354 4.225c-2.08 0-3.903 1.988-3.903 4.255 0 5.74 7.034 11.596 8.55 11.658 1.518-.062 8.55-5.917 8.55-11.658 0-2.267-1.823-4.255-3.903-4.255-2.528 0-3.94 2.936-3.952 2.965-.23.562-1.156.562-1.387 0-.014-.03-1.425-2.965-3.955-2.965z"/>
          </svg>
          <span>${post.fav_count}</span>
        </div>
        
        <div class="engagement-item" data-type="views">
          <svg class="engagement-icon" viewBox="0 0 24 24">
            <path d="M8.75 21V3h2v18h-2zM18 21V8.5h2V21h-2zM4 21l.004-10H6v10H4zm9.248 0v-7h2v7h-2z"/>
          </svg>
          <span>${this.formatNumber((post.score.up || 0) * 10)}</span>
        </div>
        
        <div class="engagement-item" data-type="share">
          <svg class="engagement-icon" viewBox="0 0 24 24">
            <path d="M17.53 7.47l-5-5c-.293-.293-.768-.293-1.06 0l-5 5c-.294.293-.294.768 0 1.06s.767.294 1.06 0L11 5.06V15c0 .553.447 1 1 1s1-.447 1-1V5.06l3.47 3.47c.293.293.767.293 1.06 0s.293-.767 0-1.06zM19.708 21.944H4.292C3.028 21.944 2 20.916 2 19.652V14c0-.553.447-1 1-1s1 .447 1 1v5.652c0 .437.377.792.708.792h15.584c.331 0 .708-.355.708-.792V14c0-.553.447-1 1-1s1 .447 1 1v5.652c0 1.264-1.028 2.292-2.292 2.292z"/>
          </svg>
        </div>
      </div>
    `

    return postDiv
  }

  async loadProfilePicture(postElement, post) {
    const profilePicElement = postElement.querySelector(".profile-pic")
    if (!profilePicElement || !post.uploader_id) return

    try {
      const avatarUrl = await this.getProfilePictureUrl(post)
      if (avatarUrl) {
        profilePicElement.innerHTML = `<img src="${avatarUrl}" alt="Profile" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`
      }
    } catch (error) {
      console.log("Error loading profile picture:", error)
    }
  }

  getRatingText(rating) {
    switch (rating) {
      case "s":
        return "Safe"
      case "q":
        return "Questionable"
      case "e":
        return "Explicit"
      default:
        return "Safe"
    }
  }

  getTimeAgo(date) {
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)

    if (diffInSeconds < 60) return `${diffInSeconds}s`
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`
    return `${Math.floor(diffInSeconds / 86400)}d`
  }

  formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
    if (num >= 1000) return (num / 1000).toFixed(1) + "K"
    return num.toString()
  }

  async handleEngagement(e) {
    const item = e.target.closest(".engagement-item")
    const type = item.dataset.type
    const countElement = item.querySelector("span")

    if (!countElement) return

    const currentCount = Number.parseInt(countElement.textContent.replace(/[KM]/, "")) || 0

    switch (type) {
      case "like":
        await this.toggleLike(item, countElement, currentCount)
        break
      case "retweet":
        this.toggleRetweet(item, countElement, currentCount)
        break
      case "reply":
        this.handleReply(item)
        break
      case "share":
        this.handleShare(item)
        break
    }
  }

  async toggleLike(item, countElement, currentCount) {
    const postId = item.dataset.postId
    const isLiked = item.classList.contains("liked")

    if (!this.isAuthenticated) {
      alert("Please log in to add favorites")
      this.showLogin()
      return
    }

    if (isLiked) {
      const success = await this.removeFromFavorites(postId)
      if (success) {
        item.classList.remove("liked")
        countElement.textContent = this.formatNumber(currentCount - 1)
      } else {
        alert("Failed to remove from favorites. Please check your login credentials.")
      }
    } else {
      const success = await this.addToFavorites(postId)
      if (success) {
        item.classList.add("liked")
        countElement.textContent = this.formatNumber(currentCount + 1)
        this.createHeartAnimation(item)
      } else {
        alert("Failed to add to favorites. Please check your login credentials.")
      }
    }
  }

  toggleRetweet(item, countElement, currentCount) {
    const isRetweeted = item.classList.contains("retweeted")

    if (isRetweeted) {
      item.classList.remove("retweeted")
      countElement.textContent = this.formatNumber(currentCount - 1)
    } else {
      item.classList.add("retweeted")
      countElement.textContent = this.formatNumber(currentCount + 1)
    }
  }

  handleReply(item) {
    item.style.transform = "scale(0.95)"
    setTimeout(() => {
      item.style.transform = "scale(1)"
    }, 150)
  }

  handleShare(item) {
    item.style.transform = "scale(0.95)"
    setTimeout(() => {
      item.style.transform = "scale(1)"
    }, 150)

    if (navigator.share) {
      navigator.share({
        title: "E621 Post",
        text: "Check out this artwork!",
        url: window.location.href,
      })
    }
  }

  createHeartAnimation(element) {
    const rect = element.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    for (let i = 0; i < 6; i++) {
      const heart = document.createElement("div")
      heart.innerHTML = "♥"
      heart.style.cssText = `
        position: fixed;
        left: ${centerX}px;
        top: ${centerY}px;
        color: #f91880;
        font-size: 12px;
        pointer-events: none;
        z-index: 9999;
        transition: all 0.6s ease-out;
      `

      document.body.appendChild(heart)

      setTimeout(() => {
        const angle = i * 60 * (Math.PI / 180)
        const distance = 30 + Math.random() * 20
        const x = Math.cos(angle) * distance
        const y = Math.sin(angle) * distance

        heart.style.transform = `translate(${x}px, ${y}px)`
        heart.style.opacity = "0"
      }, 10)

      setTimeout(() => {
        document.body.removeChild(heart)
      }, 600)
    }
  }

  handleNavigation(e) {
    const navType = e.currentTarget.dataset.nav

    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active")
    })

    e.currentTarget.classList.add("active")

    e.currentTarget.style.transform = "scale(0.9)"
    setTimeout(() => {
      if (e.currentTarget) {
        e.currentTarget.style.transform = "scale(1)"
      }
    }, 150)

    if (navType === "profile") {
      if (this.isAuthenticated) {
        this.showProfile()
      } else {
        this.showLogin()
      }
    } else if (navType === "home") {
      this.showFeed()
    }
  }

  showFeed() {
    this.currentView = "feed"
    const feed = document.getElementById("feed")
    const container = document.querySelector(".app-container")

    const existingForms = container.querySelectorAll(".login-form, .profile-section")
    existingForms.forEach((form) => form.remove())

    feed.style.display = "block"
  }

  showLogin() {
    this.currentView = "login"
    const feed = document.getElementById("feed")
    const container = document.querySelector(".app-container")

    feed.style.display = "none"

    const existingForms = container.querySelectorAll(".login-form, .profile-section")
    existingForms.forEach((form) => form.remove())

    const loginForm = document.createElement("div")
    loginForm.className = "login-form"
    loginForm.innerHTML = `
      <div class="login-container">
        <h2>Login to e621</h2>
        <p>Enter your e621 username and API key to enable favorites and other features.</p>
        <form id="loginForm">
          <div class="form-group">
            <label for="username">Username:</label>
            <input type="text" id="username" name="username" required>
          </div>
          <div class="form-group">
            <label for="apiKey">API Key:</label>
            <input type="password" id="apiKey" name="apiKey" required>
            <small>You can get your API key from your <a href="https://e621.net/users/settings" target="_blank">e621 account settings</a></small>
          </div>
          <button type="submit">Login</button>
          <button type="button" id="cancelLogin">Cancel</button>
        </form>
      </div>
    `

    container.appendChild(loginForm)

    document.getElementById("loginForm").addEventListener("submit", async (e) => {
      e.preventDefault()
      const username = document.getElementById("username").value
      const apiKey = document.getElementById("apiKey").value

      const loginBtn = e.target.querySelector('button[type="submit"]')
      loginBtn.textContent = "Logging in..."
      loginBtn.disabled = true

      const success = await this.authenticateUser(username, apiKey)
      if (success) {
        alert("Login successful!")
        this.showProfile()
      } else {
        alert("Login failed. Please check your credentials.")
        loginBtn.textContent = "Login"
        loginBtn.disabled = false
      }
    })

    document.getElementById("cancelLogin").addEventListener("click", () => {
      this.showFeed()
    })
  }

  showProfile() {
    this.currentView = "profile"
    const feed = document.getElementById("feed")
    const container = document.querySelector(".app-container")

    feed.style.display = "none"

    const existingForms = container.querySelectorAll(".login-form, .profile-section")
    existingForms.forEach((form) => form.remove())

    const profileSection = document.createElement("div")
    profileSection.className = "profile-section"
    profileSection.innerHTML = `
      <div class="profile-container">
        <h2>Profile</h2>
        <div class="profile-info">
          <p><strong>Username:</strong> ${this.username}</p>
          <p><strong>Status:</strong> Logged in</p>
        </div>
        <div class="profile-actions">
          <button id="viewE621Profile">View e621 Profile</button>
          <button id="logoutBtn">Logout</button>
          <button id="backToFeed">Back to Feed</button>
        </div>
      </div>
    `

    container.appendChild(profileSection)

    document.getElementById("viewE621Profile").addEventListener("click", () => {
      window.open(`https://e621.net/users/${this.username}`, "_blank")
    })

    document.getElementById("logoutBtn").addEventListener("click", () => {
      this.logout()
    })

    document.getElementById("backToFeed").addEventListener("click", () => {
      this.showFeed()
    })
  }

  showLoading() {
    const existing = document.getElementById("loadingIndicator")
    if (!existing) {
      const loading = document.createElement("div")
      loading.id = "loadingIndicator"
      loading.className = "loading-indicator"
      loading.innerHTML = '<div class="spinner"></div><p>Loading more posts...</p>'
      document.getElementById("feed").appendChild(loading)
    }
  }

  hideLoading() {
    const loading = document.getElementById("loadingIndicator")
    if (loading) {
      loading.remove()
    }
  }

  showError(message) {
    const feed = document.getElementById("feed")
    feed.innerHTML = `
      <div class="error-message">
        <p>${message}</p>
        <button class="retry-btn" onclick="location.reload()">Retry</button>
      </div>
    `
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new E621Feed()
})
