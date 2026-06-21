import React, { useState, useEffect } from "react";
import { 
  Tv, 
  Search, 
  Heart, 
  Plus, 
  HelpCircle, 
  Clock, 
  ListRestart, 
  SlidersHorizontal, 
  Check, 
  AlertCircle,
  Eye,
  EyeOff,
  Radio,
  FileText,
  Bookmark,
  Share2,
  ListVideo,
  Database,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List
} from "lucide-react";
import { channelsData, categories } from "./channelsData";
import { Channel, PlaybackStatus } from "./types";
import HlsPlayer from "./components/HlsPlayer";

export default function App() {
  // Navigation & Search State
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [isCategoriesExpanded, setIsCategoriesExpanded] = useState<boolean>(false);
  const [isHoveredSidebar, setIsHoveredSidebar] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showHidden, setShowHidden] = useState<boolean>(true); // default true to load all sports links
  const [viewMode, setViewMode] = useState<"list" | "grid">(() => {
    try {
      const saved = localStorage.getItem("iptv_view_mode");
      return (saved === "grid" || saved === "list") ? saved : "list";
    } catch {
      return "list";
    }
  });

  // Save viewMode when it changes
  useEffect(() => {
    try {
      localStorage.setItem("iptv_view_mode", viewMode);
    } catch (e) {
      console.warn("Failed to save view mode", e);
    }
  }, [viewMode]);

  // Current selected channel (default to first matching channel)
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);

  // Favorites state loaded from localStorage
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("iptv_favorites");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // User-created custom channels loaded from localStorage
  const [customChannels, setCustomChannels] = useState<Channel[]>(() => {
    try {
      const saved = localStorage.getItem("iptv_custom_channels");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Custom Stream input states
  const [customName, setCustomName] = useState<string>("");
  const [customUrl, setCustomUrl] = useState<string>("");
  const [customCategory, setCustomCategory] = useState<string>("Bangla");
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customError, setCustomError] = useState<string>("");
  const [successToast, setSuccessToast] = useState<string>("");

  // System status
  const [playerStatus, setPlayerStatus] = useState<PlaybackStatus>("idle");
  const [bdClock, setBdClock] = useState<string>("");

  // Bangladesh (BDT) Standard Time live clock updater
  useEffect(() => {
    const updateBDTClock = () => {
      const now = new Date();
      // UTC + 6 hours for Bangladesh
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const bdtTime = new Date(utc + 3600000 * 6);
      
      const hours = String(bdtTime.getHours()).padStart(2, '0');
      const minutes = String(bdtTime.getMinutes()).padStart(2, '0');
      const seconds = String(bdtTime.getSeconds()).padStart(2, '0');
      const ampm = bdtTime.getHours() >= 12 ? 'PM' : 'AM';
      
      setBdClock(`${hours}:${minutes}:${seconds} ${ampm} (BDT)`);
    };

    updateBDTClock();
    const interval = setInterval(updateBDTClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Sync favorites to localStorage
  useEffect(() => {
    localStorage.setItem("iptv_favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Sync custom channels to localStorage
  useEffect(() => {
    localStorage.setItem("iptv_custom_channels", JSON.stringify(customChannels));
  }, [customChannels]);

  // Lock body scroll on desktop when user is hovering over any scrollable element in the sidebar
  useEffect(() => {
    if (isHoveredSidebar && window.innerWidth >= 1024) {
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '6px'; // matching custom scrollbar to avoid layout shifting
    } else {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, [isHoveredSidebar]);

  // Merge default channels & custom channels
  const allChannels = [...channelsData, ...customChannels];

  // Set default selected channel on load
  useEffect(() => {
    if (!selectedChannel && allChannels.length > 0) {
      // Find first visible or any
      const initial = allChannels.find(c => c.status !== "hidden") || allChannels[0];
      setSelectedChannel(initial);
    }
  }, [allChannels, selectedChannel]);

  // Handle category count badge builder
  const getCategoryCount = (catName: string) => {
    if (catName === "All") {
      return allChannels.filter(c => showHidden || c.status !== "hidden").length;
    }
    return allChannels.filter(c => 
      c.category === catName && 
      (showHidden || c.status !== "hidden")
    ).length;
  };

  const getFavoriteCount = () => {
    return allChannels.filter(c => favorites.includes(c.name)).length;
  };

  // Filter list matching criteria
  const filteredChannels = allChannels.filter(channel => {
    // 1. Filter by category
    const matchesCategory = selectedCategory === "All" || 
      (selectedCategory === "Favorites" ? favorites.includes(channel.name) : channel.category === selectedCategory);
    
    // 2. Filter by search query
    const matchesSearch = channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      channel.category.toLowerCase().includes(searchQuery.toLowerCase());

    // 3. Filter by hidden status toggler
    const matchesHidden = showHidden ? true : channel.status !== "hidden";

    return matchesCategory && matchesSearch && matchesHidden;
  });

  // Toggle favorite trigger
  const toggleFavorite = (channelName: string) => {
    setFavorites(prev => 
      prev.includes(channelName) 
        ? prev.filter(name => name !== channelName) 
        : [...prev, channelName]
    );
  };

  // Show status-specific toast helpers
  const triggerToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(""), 3000);
  };

  // Add custom channel logic
  const handleAddCustomChannel = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError("");

    if (!customName.trim()) {
      setCustomError("Please enter a station name.");
      return;
    }
    if (!customUrl.trim()) {
      setCustomError("Please enter a streaming m3u8 or mp4 URL.");
      return;
    }

    try {
      new URL(customUrl);
    } catch {
      setCustomError("Please enter a valid absolute HTTP or HTTPS streaming URL.");
      return;
    }

    const newChannel: Channel = {
      name: customName.trim(),
      url: customUrl.trim(),
      category: customCategory,
      status: "visible"
    };

    // Check duplicate
    if (allChannels.some(c => c.name.toLowerCase() === newChannel.name.toLowerCase())) {
      setCustomError("A channel with this name already exists.");
      return;
    }

    setCustomChannels(prev => [...prev, newChannel]);
    setSelectedChannel(newChannel); // Autoplay
    setCustomName("");
    setCustomUrl("");
    setShowCustomModal(false);
    triggerToast(`"${newChannel.name}" added successfully to your library!`);
  };

  const handleDeleteCustomChannel = (e: React.MouseEvent, channelName: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete "${channelName}"?`)) {
      setCustomChannels(prev => prev.filter(c => c.name !== channelName));
      setFavorites(prev => prev.filter(name => name !== channelName));
      if (selectedChannel?.name === channelName) {
        setSelectedChannel(channelsData[0]);
      }
      triggerToast("Channel removed successfully.");
    }
  };

  // Channel gradient background helper for fallback logo icon
  const getGradientForCategory = (cat: string) => {
    switch (cat) {
      case "All": return "from-slate-600 to-slate-800";
      case "Bangla": return "from-emerald-600 to-red-600";
      case "Indian Bangla": return "from-teal-500 to-blue-600";
      case "Hindi": return "from-orange-500 to-amber-600";
      case "Movies": return "from-indigo-600 to-violet-700";
      case "Sports": return "from-red-500 to-rose-700";
      case "News": return "from-sky-700 to-slate-800";
      case "Documentary": return "from-emerald-500 to-teal-700";
      case "Kids": return "from-pink-500 to-yellow-500";
      case "Music": return "from-violet-500 to-fuchsia-600";
      case "Islamic": return "from-emerald-600 to-teal-800";
      case "Entertainment": return "from-cyan-500 to-blue-600";
      default: return "from-neutral-700 to-neutral-900";
    }
  };

  const getInitials = (fullName: string) => {
    return fullName
      .replace(/[\(\[\{\-\_].*?[\)\]\}]/g, '') // remove brackets content
      .split(/\s+/)
      .filter(word => word.length > 0)
      .map(word => word[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || "TV";
  };

  // Mock schedule / TV Guide generator based on current hour to look professional
  const getMockSchedule = (channelName: string) => {
    const currentHour = new Date().getHours();
    
    // Simple deterministic schedules based on channel name char codes
    const seed = channelName.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const scheduleData = [
      { current: "Live Morning Bulletin", next: "Talk of the Town @ 11:30 AM" },
      { current: "Midday Sports Review", next: "World League Finals Live @ 2:00 PM" },
      { current: "Super Hit Matinee Special", next: "Mega Serial Drama Episode @ 5:30 PM" },
      { current: "Evening Prime Time News", next: "International News Tonight @ 9:00 PM" },
      { current: "Sufiana Classical Sangeet Hour", next: "Late Night Cinematic Thriller @ Midnight" },
      { current: "Animated Kids Carnival", next: "Evening Cartoons Fiesta @ 4:00 PM" },
    ];

    const idx = (seed + currentHour) % scheduleData.length;
    return scheduleData[idx];
  };

  return (
    <div className="min-h-screen bg-[#07070a] text-zinc-100 flex flex-col font-sans antialiased selection:bg-amber-500 selection:text-neutral-950">
      
      {/* Dynamic Toast System */}
      {successToast && (
        <div id="toast-success" className="fixed bottom-6 right-6 z-50 bg-[#0e0e12] border border-amber-500/30 text-amber-400 px-4 py-3 rounded-2xl shadow-2xl shadow-black/80 flex items-center gap-2.5 text-xs font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="h-4 w-4 bg-amber-500/10 text-amber-400 rounded p-0.5" />
          {successToast}
        </div>
      )}

      {/* Main Header */}
      <header className="border-b border-zinc-900/80 bg-[#0c0c11]/90 backdrop-blur-md sticky top-0 z-40 px-4 md:px-8 py-4.5 flex flex-col md:flex-row gap-4 justify-between items-center shadow-lg shadow-black/20">
        <div className="flex items-center gap-3.5">
          <div className="p-2.5 bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 rounded-2xl text-amber-400 shadow-lg shadow-amber-500/5">
            <Tv className="h-6 w-6 stroke-[1.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
                Smart IPTV Player
              </h1>
              <span className="text-[9px] bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 px-2 py-0.5 font-extrabold uppercase tracking-widest rounded-full shadow-sm">
                PRO v6.0
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium tracking-wide">
              Made with <Heart className="h-2.5 w-2.5 inline fill-amber-500 stroke-none mb-0.5 animate-pulse" /> by rashedpervej | IPTV HEXA & xfireflix base
            </p>
          </div>
        </div>

        {/* Live clocks & Statistics bar */}
        <div className="flex items-center gap-3 flex-wrap md:flex-nowrap justify-center select-none">
          {/* UTC Clock */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121218]/90 border border-zinc-800/80 rounded-xl shadow-inner">
            <Clock className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-mono font-medium text-stone-200 tracking-wide">{bdClock || "Loading Clock..."}</span>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#121218]/90 border border-zinc-800/80 rounded-xl text-xs text-zinc-300 font-mono shadow-inner">
            <Radio className="h-3.5 w-3.5 text-teal-400 animate-pulse" />
            <span>Active: <strong className="text-white font-semibold">{allChannels.length}</strong></span>
          </div>

          {/* Add custom Link CTA button */}
          <button
            onClick={() => setShowCustomModal(true)}
            className="px-4 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/10 transition-all duration-200 active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
            Add URL
          </button>
        </div>
      </header>

      {/* Primary Layout Arena */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 leading-normal">
        
        {/* Left Side Column: TV Channels Organizer & Sidebar (4 cols) */}
        <div 
          onMouseEnter={() => setIsHoveredSidebar(true)}
          onMouseLeave={() => setIsHoveredSidebar(false)}
          className="col-span-1 lg:col-span-4 flex flex-col gap-5"
        >
          
          {/* Quick Filters Panel (Search and Hidden Mode Switcher) */}
          <div className="bg-[#0e0e14] p-5 rounded-3xl border border-zinc-900/80 flex flex-col gap-3.5 shadow-xl shadow-black/10">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 h-4 w-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search channels, languages, matches..."
                className="w-full bg-[#07070a]/80 border border-zinc-800/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/20 transition-all duration-200"
                id="search-input"
              />
            </div>

            {/* Sub Filter: Toggle Hidden Channels Support */}
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-medium">Including Hidden VIP Links</span>
              <button
                onClick={() => {
                  setShowHidden(!showHidden);
                  triggerToast(showHidden ? "Filtered out hidden channels" : "Showing all default hidden VIP streams");
                }}
                className={`py-1 px-3 rounded-xl border flex items-center gap-1.5 cursor-pointer font-bold text-[11px] uppercase tracking-wide transition-all duration-250 ${
                  showHidden 
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400" 
                    : "bg-[#07070a] border-zinc-800 text-zinc-400 hover:text-white"
                }`}
              >
                {showHidden ? <Eye className="h-3 w-3 text-amber-400" /> : <EyeOff className="h-3 w-3" />}
                {showHidden ? "Enabled" : "Disabled"}
              </button>
            </div>
          </div>

          {/* Scrolling Categories Rails */}
          <div className="flex flex-col gap-2 bg-[#0e0e14] p-4.5 rounded-3xl border border-zinc-900/80 shadow-xl shadow-black/10">
            <div 
              onClick={() => setIsCategoriesExpanded(!isCategoriesExpanded)}
              className="flex items-center justify-between px-1 cursor-pointer select-none group"
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5 text-amber-500 group-hover:text-amber-400 transition-colors" />
                <h3 className="text-[11px] font-extrabold text-zinc-400 tracking-wider uppercase group-hover:text-zinc-200 transition-colors">Categories</h3>
                {!isCategoriesExpanded && (
                  <span className="ml-1.5 text-[9px] bg-amber-500/10 text-amber-400 px-2 py-0.5 font-bold uppercase tracking-wide rounded-md border border-amber-500/20">
                    {selectedCategory}
                  </span>
                )}
              </div>
              <div className="p-1 hover:bg-zinc-800/50 rounded-lg transition-colors">
                {isCategoriesExpanded ? (
                  <ChevronUp className="h-4 w-4 text-zinc-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-colors animate-pulse" />
                )}
              </div>
            </div>
            
            {isCategoriesExpanded && (
              <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pt-2 pb-1 scrollbar-none overscroll-contain transition-all duration-300">
                
                {/* Category: Favorite stars */}
                <button
                  onClick={() => {
                    setSelectedCategory("Favorites");
                    setIsCategoriesExpanded(false);
                  }}
                  className={`flex-shrink-0 flex items-center justify-between gap-3 px-4.5 py-2.5 text-left rounded-2xl text-xs font-bold select-none cursor-pointer border transition-all duration-200 ${
                    selectedCategory === "Favorites"
                      ? "bg-gradient-to-r from-amber-500 to-amber-600 text-neutral-950 border-amber-400 shadow-lg shadow-amber-500/10 scale-[1.01]"
                      : "bg-[#07070a]/60 border-zinc-900/60 hover:bg-[#07070a] text-zinc-305 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Bookmark className={`h-3.5 w-3.5 ${selectedCategory === "Favorites" ? "fill-neutral-950 text-neutral-950" : "fill-none text-amber-400"}`} />
                    My Favorites
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg ${
                    selectedCategory === "Favorites" ? "bg-neutral-950/20 text-neutral-950" : "bg-[#16161f] text-zinc-400"
                  }`}>
                    {getFavoriteCount()}
                  </span>
                </button>

                {/* Static Categories */}
                {categories.map((cat, idx) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsCategoriesExpanded(false);
                    }}
                    className={`flex-shrink-0 flex items-center justify-between gap-3 px-4.5 py-2.5 text-left rounded-2xl text-xs font-bold select-none cursor-pointer border transition-all duration-200 ${
                      selectedCategory === cat
                        ? "bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 border-amber-400 shadow-lg shadow-amber-500/10 scale-[1.01]"
                        : "bg-[#07070a]/60 border-zinc-900/60 hover:bg-[#07070a] text-zinc-305 hover:text-white"
                    }`}
                  >
                    <span className="capitalize">{cat}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-lg ${
                      selectedCategory === cat ? "bg-stone-950/20 text-stone-950" : "bg-[#16161f] text-zinc-400"
                    }`}>
                      {getCategoryCount(cat)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Dynamic Channels Playlist Grid */}
          <div className="flex flex-col gap-2 flex-1 max-h-[480px] lg:max-h-[580px] overflow-y-auto pr-1 overscroll-contain">
            <div className="flex items-center justify-between px-2 mb-1.5 pt-1">
              <h2 className="text-[11px] font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5 select-none">
                <ListVideo className="h-4 w-4 text-amber-500" />
                Channels ({filteredChannels.length})
              </h2>
              <div className="flex items-center gap-2">
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery("")} 
                    className="text-[10px] text-amber-400 font-semibold hover:text-amber-300 transition-colors cursor-pointer mr-1.5"
                  >
                    Clear search
                  </button>
                )}
                <div className="flex items-center bg-[#07070a] p-1 rounded-xl border border-zinc-800/80">
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === "list" 
                        ? "bg-amber-500 text-stone-950 shadow-md" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="List View"
                  >
                    <List className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1 rounded-lg transition-all cursor-pointer ${
                      viewMode === "grid" 
                        ? "bg-amber-500 text-stone-950 shadow-md" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                    title="Grid View"
                  >
                    <LayoutGrid className="h-3.5 w-3.5 stroke-[2.5]" />
                  </button>
                </div>
              </div>
            </div>

            {filteredChannels.length === 0 ? (
              <div className="p-10 text-center bg-[#0e0e14]/40 border border-dashed border-zinc-800/80 rounded-3xl">
                <AlertCircle className="h-8 w-8 text-zinc-600 mx-auto mb-2.5" />
                <p className="text-xs text-zinc-400 leading-normal">No channels found matching the current filters.</p>
                {selectedCategory === "Favorites" && (
                  <button 
                    onClick={() => setSelectedCategory("All")}
                    className="mt-3.5 text-xs text-amber-400 font-bold hover:underline cursor-pointer"
                  >
                    Browse All Channels
                  </button>
                )}
              </div>
            ) : viewMode === "list" ? (
              <div className="space-y-2">
                {filteredChannels.map((channel, i) => {
                  const isSelected = selectedChannel?.name === channel.name;
                  const isFav = favorites.includes(channel.name);
                  const isCustom = customChannels.some(cc => cc.name === channel.name);

                  return (
                    <div
                      key={`${channel.name}-${i}`}
                      onClick={() => setSelectedChannel(channel)}
                      className={`group w-full flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all duration-200 select-none border ${
                        isSelected 
                          ? "bg-[#121218]/90 border-amber-500/40 shadow-xl shadow-amber-500/5 ring-1 ring-amber-500/10" 
                          : "bg-[#0e0e14]/65 border-zinc-900/40 hover:bg-[#121218] hover:border-zinc-800/60"
                      }`}
                    >
                      {/* Left: Indicator Initials + Logo / Title */}
                      <div className="flex items-center gap-3.5 truncate">
                        {/* Channel Station Logo Fallback Grid */}
                        <div className={`h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br ${getGradientForCategory(channel.category)} flex items-center justify-center text-xs font-black text-white border border-white/10 shadow overflow-hidden relative`}>
                          {channel.logo ? (
                            <img 
                              src={channel.logo} 
                              alt={channel.name}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-contain"
                              onError={(e) => {
                                // Clear image src if failed to trigger text initials
                                (e.target as any).style.display = 'none';
                              }}
                            />
                          ) : null}
                          <span className="absolute text-[10px] drop-shadow-md font-mono">{getInitials(channel.name)}</span>
                        </div>

                        {/* Text */}
                        <div className="truncate">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-stone-100 tracking-wide truncate group-hover:text-amber-400 transition-colors">
                              {channel.name}
                            </span>
                            {channel.status === "hidden" && (
                              <span className="text-[8px] bg-red-950/40 text-red-400 font-mono px-1 font-bold border border-red-900/35 rounded uppercase">VIP</span>
                            )}
                            {isCustom && (
                              <span className="text-[8px] bg-blue-950/40 text-blue-400 border border-blue-900/40 font-mono px-1 font-bold rounded uppercase">My</span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-500 font-medium tracking-wide">
                            {channel.category}
                          </span>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(channel.name);
                          }}
                          className={`p-1.5 rounded-lg hover:bg-zinc-800/60 transition-colors cursor-pointer ${isFav ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`}
                          title="Save to Favorites"
                        >
                          <Heart className={`h-4 w-4 transition-transform duration-200 active:scale-120 ${isFav ? "fill-amber-400" : "fill-none"}`} />
                        </button>

                        {isCustom && (
                          <button
                            onClick={(e) => handleDeleteCustomChannel(e, channel.name)}
                            className="p-1.5 rounded-lg hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Custom Channel"
                          >
                            <span className="text-sm font-black">&times;</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5">
                {filteredChannels.map((channel, i) => {
                  const isSelected = selectedChannel?.name === channel.name;
                  const isFav = favorites.includes(channel.name);
                  const isCustom = customChannels.some(cc => cc.name === channel.name);

                  return (
                    <div
                      key={`${channel.name}-${i}`}
                      onClick={() => setSelectedChannel(channel)}
                      className={`group relative flex flex-col p-3 rounded-2xl cursor-pointer transition-all duration-200 select-none border min-h-[120px] justify-between ${
                        isSelected 
                          ? "bg-[#121218]/90 border-amber-500/40 shadow-xl shadow-amber-500/5 ring-1 ring-amber-500/10" 
                          : "bg-[#0e0e14]/65 border-zinc-900/40 hover:bg-[#121218] hover:border-zinc-800/60"
                      }`}
                    >
                      {/* Top Corner Controls (Favorites / Custom Delete) */}
                      <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(channel.name);
                          }}
                          className={`p-1 rounded-md hover:bg-zinc-800/60 transition-colors cursor-pointer ${isFav ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"}`}
                          title="Save to Favorites"
                        >
                          <Heart className={`h-3.5 w-3.5 transition-transform duration-200 active:scale-120 ${isFav ? "fill-amber-400" : "fill-none"}`} />
                        </button>

                        {isCustom && (
                          <button
                            onClick={(e) => handleDeleteCustomChannel(e, channel.name)}
                            className="p-1 rounded-md hover:bg-rose-950/40 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete Custom Channel"
                          >
                            <span className="text-xs font-black leading-none">&times;</span>
                          </button>
                        )}
                      </div>

                      {/* Header Left logo */}
                      <div className={`h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br ${getGradientForCategory(channel.category)} flex items-center justify-center text-[10px] font-black text-white border border-white/10 shadow overflow-hidden relative mb-2`}>
                        {channel.logo ? (
                          <img 
                            src={channel.logo} 
                            alt={channel.name}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              (e.target as any).style.display = 'none';
                            }}
                          />
                        ) : null}
                        <span className="absolute text-[8px] drop-shadow-md font-mono">{getInitials(channel.name)}</span>
                      </div>

                      {/* Meta Information Footer (Title, Tag badges) */}
                      <div className="flex flex-col gap-0.5 w-full pr-1.5">
                        <span className="text-[11px] font-bold text-stone-100 tracking-wide truncate group-hover:text-amber-400 transition-colors block max-w-full">
                          {channel.name}
                        </span>
                        
                        <div className="flex items-center justify-between gap-1 w-full mt-1.5">
                          <span className="text-[9px] text-zinc-500 font-medium tracking-wide truncate block">
                            {channel.category}
                          </span>
                          
                          <div className="flex items-center gap-0.5 shrink-0">
                            {channel.status === "hidden" && (
                              <span className="text-[7px] bg-red-950/40 text-red-400 font-mono px-1 font-bold border border-red-900/35 rounded uppercase">VIP</span>
                            )}
                            {isCustom && (
                              <span className="text-[7px] bg-blue-950/40 text-blue-400 border border-blue-900/40 font-mono px-1 font-bold rounded uppercase">My</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Side Column: Video Player screen & Controls (8 cols) */}
        <div className="col-span-1 lg:col-span-8 flex flex-col gap-6">
          
          {selectedChannel ? (
            <div className="flex flex-col gap-5">
              
              {/* Premium Hls Video player viewport frame */}
              <HlsPlayer
                url={selectedChannel.url}
                name={selectedChannel.name}
                category={selectedChannel.category}
                onStatusChange={(s) => setPlayerStatus(s)}
              />

              {/* Station Metadatas & Controls dashboard */}
              <div className="bg-[#0e0e14] border border-zinc-900/80 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl shadow-black/15">
                
                {/* Station general header details */}
                <div className="flex gap-4 items-center">
                  <div className={`h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br ${getGradientForCategory(selectedChannel.category)} flex items-center justify-center text-sm font-black text-white border border-white/10 shadow overflow-hidden relative`}>
                    {selectedChannel.logo ? (
                      <img 
                        src={selectedChannel.logo} 
                        alt={selectedChannel.name} 
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                    ) : null}
                    <span className="absolute text-xs font-mono">{getInitials(selectedChannel.name)}</span>
                  </div>

                  <div>
                    <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                      {selectedChannel.name}
                      <button
                        onClick={() => toggleFavorite(selectedChannel.name)}
                        className={`transition hover:scale-110 active:scale-95 cursor-pointer ${
                          favorites.includes(selectedChannel.name) ? "text-amber-400" : "text-zinc-600 hover:text-zinc-400"
                        }`}
                        title="Star Favorite"
                      >
                        <Heart className={`h-4.5 w-4.5 ${favorites.includes(selectedChannel.name) ? "fill-amber-400" : "fill-none"}`} />
                      </button>
                    </h2>
                    <p className="text-xs text-zinc-400 flex flex-wrap items-center gap-2 mt-0.5">
                      <span className="font-extrabold text-amber-400 bg-amber-500/10 p-1 py-0.5 rounded text-[9px] border border-amber-500/20 uppercase tracking-widest">
                        {selectedChannel.category}
                      </span>
                      <span className="text-zinc-600 font-bold">•</span>
                      <span className="text-zinc-500 text-[10px]">Source:</span> 
                      <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[150px] inline-block hover:text-amber-400 transition-colors" title={selectedChannel.url}>
                        {selectedChannel.url}
                      </span>
                    </p>
                  </div>
                </div>

                {/* Sharing Options */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(selectedChannel.url);
                      triggerToast("Stream URL copied to clipboard! Share it anywhere.");
                    }}
                    className="p-2.5 px-4 bg-[#121218] hover:bg-neutral-900 border border-zinc-800 text-zinc-300 hover:text-white transition-all rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-md"
                    title="Copy stream url"
                  >
                    <Share2 className="h-4 w-4 text-amber-500" />
                    Copy Link
                  </button>
                </div>
              </div>

              {/* Dynamic Schedules & TV Guide block */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* Simulated EPG block */}
                <div className="bg-[#0e0e14]/60 border border-zinc-900/80 p-5 rounded-3xl shadow-xl shadow-black/5">
                  <div className="flex items-center gap-2 mb-3.5 border-b border-zinc-900/80 pb-2.5">
                    <Clock className="h-4 w-4 text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Live Program Scheduler</h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] font-extrabold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 tracking-wider">NOW BROADCASTING</span>
                      <p className="text-sm font-bold text-white mt-2">{getMockSchedule(selectedChannel.name).current}</p>
                      <p className="text-xs text-zinc-500 mt-0.5 font-medium">Duration: 60 mins • Multi-source stream signal</p>
                    </div>
                    <div className="border-t border-zinc-900/80 pt-3.5">
                      <span className="text-[9px] font-extrabold text-zinc-400 bg-zinc-800/40 px-2 py-0.5 rounded border border-zinc-800/30 tracking-wider">UP NEXT LIVE</span>
                      <p className="text-xs font-bold text-zinc-300 mt-2">{getMockSchedule(selectedChannel.name).next}</p>
                    </div>
                  </div>
                </div>

                {/* Helpful Instruction Troubleshooting card */}
                <div className="bg-[#0e0e14]/60 border border-zinc-900/80 p-5 rounded-3xl flex flex-col justify-between shadow-xl shadow-black/5">
                  <div>
                    <div className="flex items-center gap-2 mb-3.5 border-b border-zinc-900/80 pb-2.5">
                      <HelpCircle className="h-4 w-4 text-amber-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-300">Troubleshooting Streams</h3>
                    </div>
                    <ul className="text-[11px] text-zinc-400 space-y-2 leading-relaxed">
                      <li>⚠️ IPTV servers are notoriously unstable. If any stream shows offline, try clicking the <strong className="text-white">Reload Stream</strong> trigger inside the player.</li>
                      <li>🔒 Mixed Contents: Absolute raw HTTP links loaded over HTTPS might be restricted. If a stream fails, load using HTTP or use appropriate deshi network resources.</li>
                      <li>🌍 Geo-restrictions: Some premium regional channels require local ISP paths.</li>
                    </ul>
                  </div>
                  <div className="mt-4 text-[9px] font-mono text-zinc-600 text-right flex items-center justify-end gap-1.5 border-t border-zinc-900/40 pt-2.5">
                    <Database className="h-3 w-3 text-amber-500/60" />
                    Streaming cache bounds: Optimal Buffer enabled
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="bg-[#0e0e14]/50 border border-zinc-900 p-16 text-center shadow-2xl flex flex-col items-center justify-center min-h-[440px] rounded-3xl">
              <Tv className="h-16 w-16 text-zinc-700 mb-4 stroke-[1.2] animate-pulse" />
              <h2 className="text-lg font-bold text-zinc-200">No TV Selected</h2>
              <p className="text-xs text-zinc-500 mt-2 max-w-sm leading-relaxed">Please pick a television channel from the sidebar playlist to load custom live streaming audio and video.</p>
            </div>
          )}

        </div>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 bg-[#07070a] py-8 px-4 md:px-8 mt-16 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="leading-relaxed">© 2026 Bengali Live Net IPTV Player. All rights reserved. Streams are publicly available and aggregated for convenience.</p>
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-md font-bold border border-amber-500/20 tracking-wider">ONLINE PLAYBACK SERVER ENTRANCE LIVE</span>
          </div>
        </div>
      </footer>

      {/* --- ADD CUSTOM MOVIE / TV MODAL MODAL PANEL --- */}
      {showCustomModal && (
        <div className="fixed inset-0 z-50 bg-[#050508]/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
          
          <div className="bg-[#0e0e14] border border-zinc-800/80 rounded-3xl max-w-md w-full p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
            
            <button
              onClick={() => {
                setShowCustomModal(false);
                setCustomError("");
              }}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white text-lg font-bold bg-[#161622] hover:bg-[#1f1f2e] h-8 w-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
            >
              &times;
            </button>

            <div className="flex items-center gap-2.5 mb-4">
              <Tv className="h-5 w-5 text-amber-500" />
              <h3 className="text-base font-extrabold text-white">Add Custom Channel / Stream</h3>
            </div>

            <p className="text-xs text-zinc-400 mb-5 leading-relaxed">
              You can insert any HLS streaming URL (.m3u8), raw stream link, or direct media link (.mp4/.mkv), and play it using our advanced integrated core player.
            </p>

            <form onSubmit={handleAddCustomChannel} className="space-y-4">
              
              <div>
                <label className="block text-[10px] font-bold text-amber-400/90 uppercase tracking-wider mb-1.5">
                  Channel / Stream Name
                </label>
                <input
                  type="text"
                  required
                  value={customName}
                  onChange={e => setCustomName(e.target.value)}
                  placeholder="e.g. My Favorite Sports Channel"
                  className="w-full bg-[#07070a] border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-400/90 uppercase tracking-wider mb-1.5">
                  Stream URL (.m3u8, .mp4, etc.)
                </label>
                <input
                  type="url"
                  required
                  value={customUrl}
                  onChange={e => setCustomUrl(e.target.value)}
                  placeholder="https://example.com/playlist.m3u8"
                  className="w-full bg-[#07070a] border border-zinc-800 focus:border-amber-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-650 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-400/90 uppercase tracking-wider mb-1.5">
                  Category Tag
                </label>
                <select
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  className="w-full bg-[#07070a] border border-zinc-800 focus:border-amber-500 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="Bangla">Bangla</option>
                  <option value="Indian Bangla">Indian Bangla</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Movies">Movies</option>
                  <option value="Sports">Sports</option>
                  <option value="News">News</option>
                  <option value="Documentary">Documentary</option>
                  <option value="Kids">Kids</option>
                  <option value="Music">Music</option>
                  <option value="Islamic">Islamic</option>
                  <option value="Entertainment">Entertainment</option>
                </select>
              </div>

              {customError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {customError}
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCustomModal(false);
                    setCustomError("");
                  }}
                  className="flex-1 py-2.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-300 font-bold text-xs rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-neutral-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/10 cursor-pointer"
                >
                  Add Stream
                </button>
              </div>

            </form>
          </div>

        </div>
      )}

    </div>
  );
}
