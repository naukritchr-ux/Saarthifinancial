
import { useState, useEffect, useRef } from "react"
// --- MODIFICATION START ---
// Updated imports for the new DatePicker component
import { format, parse, isValid, differenceInYears, startOfDay } from "date-fns"
// --- MODIFICATION END ---
import { PhoneInput as ReactPhoneInput } from "react-international-phone"
import "react-international-phone/style.css"
import { FiTrash2, FiPlus } from "react-icons/fi"

// --- MODIFICATION START: ADDED HELPER FUNCTION AND IMPORTS ---
import { Upload } from "lucide-react"

// The Groq API key lives on the server — never exposed to the browser.
const fetchCompanyDetailsFromGemini = async (companyName) => {
  if (!companyName || companyName.trim().length < 3) return null

  try {
    const response = await fetch("https://api.sarthi360.in/api/clientRecommendations/autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyName: companyName.trim() }),
    })

    const data = await response.json()

    if (response.status === 429) {
      throw new Error(data?.error || "Rate limit hit. Wait a moment and retry.")
    }
    if (!response.ok) {
      throw new Error(data?.error || `Server error ${response.status}`)
    }

    // Backend returns { ok: true, filledCount, totalFields, data: { ...fields } }
    return data?.ok ? data.data : null
  } catch (err) {
    console.error("AI autofill error:", err)
    throw err
  }
}
const resizeImage = (file, maxWidth = 200, maxHeight = 200, quality = 0.8) => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (readerEvent) => {
      const image = new Image()
      image.onload = () => {
        const canvas = document.createElement("canvas")
        let width = image.width
        let height = image.height

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width)
            width = maxWidth
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height)
            height = maxHeight
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx.drawImage(image, 0, 0, width, height)
        const dataUrl = canvas.toDataURL("image/jpeg", quality)
        resolve(dataUrl)
      }
      image.src = readerEvent.target.result
    }
    reader.readAsDataURL(file)
  })
}

// --- NAME MATCHING HELPERS (From Dashboard Logic) ---
const normalizeName = (name) => {
  if (!name || typeof name !== "string") return ""
  return name.trim().replace(/[^\w\s]/gi, "").replace(/\s+/g, " ").toLowerCase()
}

const isNameMatch = (loggedInUserName, dataName) => {
  if (!loggedInUserName || !dataName) return false;
  
  const nLogin = normalizeName(loggedInUserName);
  const nData = normalizeName(dataName);

  // STEP 1: Strict Match - This covers 99% of users (like Anindita Sinha)
  if (nLogin === nData) return true;

  // STEP 2: Check if the logged-in user is "Special" (allowed to have fuzzy matching)
  const isSpecialUser = SPECIFIED_TEAM_LEADERS.includes(nLogin) || 
                        SPECIFIED_BD_MEMBERS.includes(nLogin);

  // STEP 3: If NOT special, and they didn't pass Step 1, they are NOT a match.
  // This prevents Anindita Sinha from matching Anindita S Vaidya.
  if (!isSpecialUser) return false;

  // STEP 4: Fuzzy Logic - ONLY for Specified Team Leaders/BD Members
  const loginWords = nLogin.split(" ").filter(Boolean);
  const dataWords = nData.split(" ").filter(Boolean);

  const loginInData = loginWords.length > 0 && loginWords.every((word) => dataWords.includes(word));
  const dataInLogin = dataWords.length > 0 && dataWords.every((word) => loginWords.includes(word));

  return loginInData || dataInLogin;
}
// --- RESTRICTED USER LISTS (From Dashboard) ---
const SPECIFIED_TEAM_LEADERS = [
  "SURBHI JAIN", "Surbhi Vinod Jain", "Suganya", "Suganya Sankaran Yadav", "Vedika Tolani",
  "Vedika Girish Tolani", "Joyeeta Khaskel", "Joyeeta Joydeb Khaskel", "Avadai Marthuvar",
  "Avadai Esakki Muthu Sundaram Marthuvar", "Pune . Office" , 
].map(normalizeName)

const SPECIFIED_BD_MEMBERS = [
  "Rajalaxmi Das", 
  "Vaishnavi Bhagat", 
  "Sammed Magdum", 
  "Ashutosh", 
  "Jahnvi  - Thakker",
  "Mama paltasingh", 
  "Gayatri Pattasani",
   "Komal Bhanushali", // Added Komal Bhanushali here
  "Aagam Kamlesh Sheth",
  "Shruti Adhav",
  "Ashutosh",
    "Sneha Jaiswal",
  "PURVA JITENDRA UPARE",
  "Tisha Tiwari",
  "Anshu Subhash Jha",
  "Naomi Mary Luise",
  "Jiya Pran Sanda",
  "Sandhya kumari shyam mahto",
  "Ruchi shukla "
].map(normalizeName)

const isSpecifiedTeamLeader = (user) => {
  if (!user || !user.name) return false;
  const normalizedUserName = normalizeName(user.name);
  // Changed from .includes to === for strict list membership
  return SPECIFIED_TEAM_LEADERS.some((specName) => specName === normalizedUserName);
}

const isSpecifiedBDMember = (user) => {
  if (!user || !user.name) return false;
  const normalizedUserName = normalizeName(user.name);
  // Changed from .includes to === for strict list membership
  return SPECIFIED_BD_MEMBERS.some((specName) => specName === normalizedUserName);
}
// -------------------------------------------------------

// --- MODIFICATION END ---

// --- MODIFICATION START ---
// New static data for Industries and Sub-Industries based on the provided document.
const STATIC_INDUSTRIES = [
  { id: 1, name: "Agriculture, Horticulture, Agritech" },
  { id: 2, name: "Airlines" },
  { id: 3, name: "Automobile" },
  { id: 4, name: "Chemical" },
  { id: 5, name: "Construction Material" },
  { id: 6, name: "Construction. & Real estate Infrastructure, Coworking" },
  { id: 7, name: "Consumer Durables" },
  { id: 8, name: "Cosmetic, Beauty" },
  { id: 9, name: "Semiconductor" },
  { id: 10, name: "Engineering" },
  { id: 11, name: "Sustainability and Environmental Services" },
  { id: 12, name: "Exporters, Importers" },
  { id: 13, name: "FMCG" },
  { id: 14, name: "Garment, Textile" },
  { id: 15, name: "Jewellery" },
  { id: 16, name: "Iron & Steel" },
  { id: 17, name: "Leather, Accessories" },
  { id: 18, name: "Office Stationery" },
  { id: 19, name: "Publishing & Printing" },
  { id: 20, name: "Petroleum & Oil - Gas" },
  { id: 21, name: "Pharmaceuticals, Labs" },
  { id: 22, name: "Power & Energy" },
  { id: 23, name: "Event planning" },
  { id: 24, name: "Retail & fashion" },
  { id: 25, name: "Shipping, Marine" },
  { id: 26, name: "Rubber & Plastic" },
  { id: 27, name: "Advertising, Media" },
  { id: 28, name: "BFSI" },
  { id: 29, name: "Logistics" },
  { id: 30, name: "E-Commerce" },
  { id: 31, name: "Entertainment, Online Games" },
  { id: 32, name: "Healthcare" },
  { id: 33, name: "Hospitality" },
  { id: 34, name: "IT Services & IT Consulting" },
  { id: 35, name: "Education & Edtech" },
  { id: 36, name: "ITES" },
  { id: 37, name: "wellness" },
  { id: 38, name: "NGOs" },
  { id: 39, name: "Fire & Safety" },
  { id: 40, name: "Telecommunication" },
  { id: 41, name: "Travel & Tourism" },
  { id: 42, name: "Chartered Accountants" },
  { id: 43, name: "Food & Beverage" },
  { id: 44, name: "Designing Agency - Architect & Interior" },
  { id: 45, name: "Manufacturing" },
  { id: 46, name: "Sports" },
  { id: 47, name: "Legal services & Law firms" },
  { id: 48, name: "Waste management" },
  { id: 49, name: "Market research" },
  { id: 50, name: "Medical Device/Equipment" },
  { id: 51, name: "PR" },
  { id: 52, name: "Packaging" },
  { id: 53, name: "Business Services & Consulting" },
  { id: 54, name: "Payroll/HRMS" },
  { id: 55, name: "Real Estate" },
  { id: 56, name: "Civic and social organistaion" },
  { id: 57, name: "Recreational Facilities" },
  { id: 58, name: "Supplier/Trader" },
  { id: 59, name: "Furniture and Home Furnishings" },
].sort((a, b) => a.name.localeCompare(b.name))

const STATIC_SUB_INDUSTRIES = [
  { id: 101, industry_id: 1, name: "Agri Commodities Trading" },
  { id: 102, industry_id: 1, name: "Organic & Sustainable Farming" },
  { id: 103, industry_id: 1, name: "dairy, poultry, aquaculture" },
  { id: 104, industry_id: 1, name: "Crop Production" },
  { id: 105, industry_id: 2, name: "Aviation" },
  { id: 106, industry_id: 2, name: "Defence" },
  { id: 107, industry_id: 2, name: "Drone" },
  { id: 108, industry_id: 2, name: "Research" },
  { id: 109, industry_id: 3, name: "Auto Ancillaries" },
  { id: 110, industry_id: 3, name: "Electric Vehicle & Dealers" },
  { id: 111, industry_id: 4, name: "Acids, Polymers, adhesives, dyes, coatings" },
  { id: 112, industry_id: 4, name: "Agrochemicals" },
  { id: 113, industry_id: 5, name: "Cement & Concrete, pipe, brick, suppliers" },
  { id: 114, industry_id: 6, name: "Residential & Commercial Projects" },
  { id: 115, industry_id: 6, name: "Roads, Highways & Bridges, construction" },
  { id: 116, industry_id: 6, name: "Property Management Services" },
  { id: 117, industry_id: 6, name: "Coworking & Flexible Workspaces" },
  { id: 118, industry_id: 7, name: "Home Appliances" },
  { id: 119, industry_id: 8, name: "Personal care, Fragrances & Perfumes, Makeup" },
  { id: 120, industry_id: 9, name: "Electronics, Batteries, Chip/ Memory Design" },
  { id: 121, industry_id: 10, name: "Civil, Mechanical, Electrical, Chemical, Software" },
  { id: 122, industry_id: 10, name: "Aerospace, Automotive, Industrial, Environmental" },
  { id: 123, industry_id: 10, name: "Structural, Automation" },
  { id: 124, industry_id: 11, name: "Environment, Cleantech, Recycling, Waste Management" },
  { id: 125, industry_id: 12, name: "Goods & materials, All" },
  { id: 126, industry_id: 13, name: "Snacks, Household Products, supermarkets" },
  { id: 127, industry_id: 14, name: "Embroidery, Garment, Textile, Apparel" },
  { id: 128, industry_id: 15, name: "Gems, Precious Jewellery, Manufacturing" },
  { id: 129, industry_id: 16, name: "Steel Plant, Rolling Mills, Steel, Iron, Mineral, Metal, Mining" },
  { id: 130, industry_id: 17, name: "Bag, Material, Leather" },
  { id: 131, industry_id: 18, name: "Hardware & Equipment, Printers, Scanners, Stationery" },
  { id: 132, industry_id: 19, name: "Tissue, paper, Newsprint, Book Print & Publishing" },
  { id: 133, industry_id: 20, name: "Refineries, Petroleum & Oil - Gas" },
  { id: 134, industry_id: 21, name: "Pharma drugs, Therapeutic, Clinical Labs / Diagnostics" },
  { id: 135, industry_id: 22, name: "Power, Solar Energy, Renewable" },
  { id: 136, industry_id: 23, name: "Corporate Events, event, Ceremony Public & Cultural Events" },
  { id: 137, industry_id: 24, name: "Apparel & Clothing, Footwear, Accessories, Toys & Games, retail" },
  { id: 138, industry_id: 25, name: "Shipping, Marine, Freight Forwarding" },
  { id: 139, industry_id: 26, name: "Wood, Plastic Recycling, Furniture, Fixtures, Fittings, Rubber" },
  { id: 140, industry_id: 27, name: "Broadcast, Outdoor, Digital, Influencer Marketing, Affiliate Marketing" },
  { id: 141, industry_id: 27, name: "Experiential & Event Advertising, Content, Media Buying & Planning" },
  { id: 142, industry_id: 28, name: "Banking, Fintech, Financial Services, wealth Management, Digital Payments, Insurance" },
  { id: 143, industry_id: 29, name: "Courier, Logistics, Supply Chain, Packaging, Transport" },
  { id: 144, industry_id: 30, name: "Online By Platform, Physical Goods, Digital Goods, Ecommerce" },
  { id: 145, industry_id: 31, name: "Film & Television, Music, Online Games" },
  { id: 146, industry_id: 32, name: "Hospitals, Medical Research, Dental, optical, Healthcare" },
  { id: 147, industry_id: 33, name: "Hotels, Restaurants, Cloud Kitchen" },
  { id: 148, industry_id: 34, name: "Information Technology (IT), Data Analytics, Al, Robotics, IOT" },
  { id: 149, industry_id: 34, name: "Software, cloud, Cybersecurity, IT Infrastructure & Networking" },
  { id: 150, industry_id: 35, name: "Institutes, Training, Edtech, School" },
  { id: 151, industry_id: 36, name: "BPO, KPO, LPO, MT" },
  { id: 152, industry_id: 37, name: "Fitness & Exercise, GYM, Nutrition & Dietetics, Herbal Medicines, Ayurveda" },
  { id: 153, industry_id: 38, name: "Trust, Charitable Institutions, NGO" },
  { id: 154, industry_id: 39, name: "Security, Safety, Facility Management" },
  { id: 155, industry_id: 40, name: "Network provider" },
  { id: 156, industry_id: 41, name: "Travel & Tour" },
  { id: 157, industry_id: 42, name: "CA, Taxation, Audit, Advisory, Associates" },
  { id: 158, industry_id: 43, name: "Food & Beverage" },
  { id: 159, industry_id: 44, name: "Designing, Interior, Architect, Land scaping" },
  { id: 160, industry_id: 45, name: "Automotive, Electronics, Machinery, Chemical, Manufacturing" },
  { id: 161, industry_id: 46, name: "Esport, Athletic" },
  { id: 162, industry_id: 47, name: "Legal services, Law firms" },
  { id: 163, industry_id: 48, name: "Recycling, Waste – Water Treatment" },
  { id: 164, industry_id: 49, name: "Market research, Trend Analysis" },
  { id: 165, industry_id: 50, name: "Instrument, Laboratory Equipment, Medical" },
  { id: 166, industry_id: 51, name: "PR" },
  { id: 167, industry_id: 52, name: "Packaging" },
  { id: 168, industry_id: 53, name: "Business Services & Consulting" },
  { id: 169, industry_id: 54, name: "Payroll/HRMS" },
  { id: 170, industry_id: 55, name: "Residential and Commercial" },
  { id: 171, industry_id: 56, name: "Civic and social organistaion" },
  { id: 172, industry_id: 37, name: "Spa" },
  { id: 173, industry_id: 57, name: "Clubs (sports/social)" },
  { id: 174, industry_id: 57, name: "Play areas" },
  { id: 175, industry_id: 57, name: "Gyms & fitness centers" },
  { id: 176, industry_id: 57, name: "Amusement & water parks" },
  { id: 177, industry_id: 58, name: "Raw Material,Machinery and Spare Parts" },
  { id: 178, industry_id: 4, name: "Speciality chemicals" },
  { id: 179, industry_id: 59, name: "Furniture and Home Furnishing Manufacturing/ sales" },
  { id: 180, industry_id: 3, name: "Service and Repair" },
].sort((a, b) => a.name.localeCompare(b.name))
// --- MODIFICATION END ---

export default function ClientDataManagement() {
  const [showForm, setShowForm] = useState(false)
  const [clients, setClients] = useState([])
  const [editingClient, setEditingClient] = useState(null)
  const [editingIndex, setEditingIndex] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filteredClients, setFilteredClients] = useState([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [clientToDelete, setClientToDelete] = useState(null)
  const [allClients, setAllClients] = useState([])
  const [allClientsForDuplicateCheck, setAllClientsForDuplicateCheck] = useState([])
  const [preloadedEmployees, setPreloadedEmployees] = useState([])
const [loadingPreloadedEmployees, setLoadingPreloadedEmployees] = useState(true)
  // --- MODIFICATION START ---
  // New state to manage view-only mode for the form
  const [isViewMode, setIsViewMode] = useState(false)
  // --- MODIFICATION END ---

  const [userPermissions, setUserPermissions] = useState({})
  const [currentUser, setCurrentUser] = useState(null)

  // **MODIFIED**: State for industries lookup now uses static data
  const [industries, setIndustries] = useState(STATIC_INDUSTRIES)
  const [industryMap, setIndustryMap] = useState({})

  // State for the advanced filtering system
  const [selectedFinancialYear, setSelectedFinancialYear] = useState("All Years")
  const [selectedMonth, setSelectedMonth] = useState("All Months")
  const [selectedQuarter, setSelectedQuarter] = useState("All Quarters")
  const [sortByField, setSortByField] = useState("")
  const [sortByOptions, setSortByOptions] = useState([])
  const [sortByValue, setSortByValue] = useState("")

  // State for the new separate status filters
  const [selectedCompanyStatus, setSelectedCompanyStatus] = useState("All")
  // **MODIFIED**: Hardcoded company status options as per requirement
  const companyStatusOptions = ["active", "non-active", "prospect", "blacklisted", "revival", "reallocation"]
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState("All")
  const [approvalStatusOptions, setApprovalStatusOptions] = useState([])
  // --- MODIFICATION START ---
  const [selectedReallocationStatus, setSelectedReallocationStatus] = useState("All")
  // --- MODIFICATION END ---

  // **NEW**: State for the Company Category filter
  const [selectedCompanyCategory, setSelectedCompanyCategory] = useState("All")
  const [companyCategoryOptions, setCompanyCategoryOptions] = useState([])

  // --- MODIFICATION: ADDED STATE FOR DATE RANGE FILTER ---
  const [filterFromDate, setFilterFromDate] = useState("")
  const [filterToDate, setFilterToDate] = useState("")
  // --- END MODIFICATION ---

  // --- NEW STATE: To hold map of FranchiseeName -> OwnerName for display purposes ---
  const [franchiseeDetailsMap, setFranchiseeDetailsMap] = useState({})

  // State for the 'Add Financial Year' modal
  const [showAddFinancialYearModal, setShowAddFinancialYearModal] = useState(false)
  const [newFinancialYear, setNewFinancialYear] = useState("")

  // State for financial years, starting from 2012 and with localStorage persistence
  const [availableFinancialYears, setAvailableFinancialYears] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const storedYears = localStorage.getItem("clientFinancialYears")
        if (storedYears) {
          const parsed = JSON.parse(storedYears)
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed
          }
        }
      } catch (error) {
        console.error("Failed to load financial years from localStorage", error)
      }
    }
    // Default generation if localStorage is empty or invalid
    const startYear = 2012
    const currentYear = new Date().getFullYear()
    const years = []
    for (let year = startYear; year <= currentYear + 5; year++) {
      years.push(`${year}-${year + 1}`)
    }
    return years
  })

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("clientFinancialYears", JSON.stringify(availableFinancialYears))
    }
  }, [availableFinancialYears])

  // Constants for filters
  const financialMonths = [
    { name: "April", index: 3 },
    { name: "May", index: 4 },
    { name: "June", index: 5 },
    { name: "July", index: 6 },
    { name: "August", index: 7 },
    { name: "September", index: 8 },
    { name: "October", index: 9 },
    { name: "November", index: 10 },
    { name: "December", index: 11 },
    { name: "January", index: 0 },
    { name: "February", index: 1 },
    { name: "March", index: 2 },
  ]
  const sortableFields = [
  { value: "companyName", label: "Company Name" },
  { value: "locationArea", label: "Location (Area)" },
  { value: "bdMembersName", label: "BD Members Name" },
  { value: "teamLeader", label: "Team Leader" },
  { value: "franchiseeName", label: "Franchisee Name" },
  // Only show "Updated By" to Admin/Staff who aren't TLs or Franchisees
  ...(currentUser?.role !== "franchisee" && !isSpecifiedTeamLeader(currentUser) && !(currentUser?.designation || "").toLowerCase().includes("team leader")
    ? [{ value: "nameOfExecutiveUpdate", label: "Updated By" }] 
    : []
  ),
]

  const fetchUserPermissions = async () => {
    try {
      const token = localStorage.getItem("token")
      if (!token) return

      const response = await fetch("https://api.sarthi360.in/api/auth/user", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const userData = await response.json()
        if (userData.email) {
          const permResponse = await fetch(`https://api.sarthi360.in/api/admin/permissions?email=${userData.email}`)
          if (permResponse.ok) {
            const permissions = await permResponse.json()
            setUserPermissions(permissions)
          }
        }
      }
    } catch (error) {
      console.error("Error fetching user permissions:", error)
    }
  }
useEffect(() => {
  const prefetchEmployees = async () => {
    try {
      setLoadingPreloadedEmployees(true)
      const response = await fetch("https://api.sarthi360.in/employees")
      if (response.ok) {
        const data = await response.json()
        setPreloadedEmployees(data)
      }
    } catch (err) {
      console.error("Error prefetching employees:", err)
    } finally {
      setLoadingPreloadedEmployees(false)
    }
  }
  prefetchEmployees()
}, [])
  // --- NEW USE EFFECT: Fetch Franchisee Details for the Sort Dropdown ---
  useEffect(() => {
    const fetchFranchiseeDetails = async () => {
      try {
        const response = await fetch("https://api.sarthi360.in/franchisee")
        if (response.ok) {
          const data = await response.json()
          const details = {}
          // Map NameAsPerAgreement to NameOfFranchiseeOwner
          data.forEach((f) => {
            if (f.nameAsPerAgreement) {
              details[f.nameAsPerAgreement] = f.nameOfFranchiseeOwner
            }
          })
          setFranchiseeDetailsMap(details)
        }
      } catch (err) {
        console.error("Error fetching franchisee details for sort map:", err)
      }
    }
    fetchFranchiseeDetails()
  }, [])
  // --------------------------------------------------------------------

  // Fetch initial data
  useEffect(() => {
    // --- MODIFICATION START ---
    // Moved user data parsing to the top to be available for fetchClients
    let parsedUser = null
    try {
      const userData = localStorage.getItem("user")
      if (userData) {
        parsedUser = JSON.parse(userData)
        setCurrentUser(parsedUser)
      }
    } catch (error) {
      console.error("Error parsing user data from localStorage", error)
    }

    fetchClients(parsedUser) // Pass user data to fetchClients
    // --- MODIFICATION END ---

    // The fetchIndustries call has been removed as we are now using static data.
    fetchUserPermissions()
  }, [])

  // **NEW**: Effect to create a performant map for industry ID to name
  useEffect(() => {
    if (industries.length > 0) {
      const newMap = industries.reduce((acc, industry) => {
        acc[industry.id] = industry.name
        return acc
      }, {})
      setIndustryMap(newMap)
    }
  }, [industries])

  // **MODIFIED**: Effect to populate filter options from all clients
  useEffect(() => {
    if (allClients.length > 0) {
      // Company Status options are now hardcoded and not generated from client data.
      const uniqueApprovalStatuses = [...new Set(allClients.map((c) => c.approvalStatus).filter(Boolean))].sort()
      setApprovalStatusOptions(uniqueApprovalStatuses)

      const uniqueCompanyCategories = [...new Set(allClients.map((c) => c.companyCategory).filter(Boolean))].sort()
      setCompanyCategoryOptions(uniqueCompanyCategories)
    }
  }, [allClients])

  // Centralized filtering logic
  useEffect(() => {
    let results = [...allClients]

    // 1. Search filter
    if (searchTerm.trim()) {
      const lowercasedTerm = searchTerm.toLowerCase()
      results = results.filter(
        (client) =>
          client.companyName?.toLowerCase().includes(lowercasedTerm) ||
          client.contactPersonName?.toLowerCase().includes(lowercasedTerm) ||
          client.bdMembersName?.toLowerCase().includes(lowercasedTerm) ||
          client.teamLeader?.toLowerCase().includes(lowercasedTerm) ||
          client.franchiseeName?.toLowerCase().includes(lowercasedTerm) ||
          client.contactPhone?.includes(searchTerm) ||
          client.contactEmail?.toLowerCase().includes(lowercasedTerm) ||
          (client.additionalCompanyNames &&
            client.additionalCompanyNames.some((company) =>
              company.name?.toLowerCase().includes(lowercasedTerm),
            )) ||
          (client.additionalContactPersons &&
            client.additionalContactPersons.some(
              (person) =>
                person.name?.toLowerCase().includes(lowercasedTerm) ||
                person.designation?.toLowerCase().includes(lowercasedTerm) ||
                person.phone?.includes(searchTerm) ||
                person.email?.toLowerCase().includes(lowercasedTerm),
            )),
      )
    }

    // 2. Financial Year filter (using dateClientAcquired)
    if (selectedFinancialYear !== "All Years") {
      const [startYear, endYear] = selectedFinancialYear.split("-").map(Number)
      const finYearStart = new Date(startYear, 3, 1) // April 1st of start year
      const finYearEnd = new Date(endYear, 2, 31, 23, 59, 59) // March 31st of end year

      results = results.filter((client) => {
        if (!client.dateClientAcquired) return false
        const acquiredDate = parse(client.dateClientAcquired, "dd/MM/yyyy", new Date())
        if (!isValid(acquiredDate)) return false
        return acquiredDate >= finYearStart && acquiredDate <= finYearEnd
      })
    }

    // 3. Month filter (using dateClientAcquired)
    // 3. Month filter (Financial Year order)
    if (selectedMonth !== "All Months") {
      results = results.filter((client) => {
        if (!client.dateClientAcquired) return false
        const acquiredDate = parse(client.dateClientAcquired, "dd/MM/yyyy", new Date())
        if (!isValid(acquiredDate)) return false
        // Match the literal month index (0 for Jan, 3 for Apr, etc.)
        return acquiredDate.getMonth() === Number.parseInt(selectedMonth)
      })
    }

    // 4. Quarter filter (FY: Q1=Apr-Jun, Q2=Jul-Sep, Q3=Oct-Dec, Q4=Jan-Mar)
    if (selectedQuarter !== "All Quarters") {
      results = results.filter((client) => {
        if (!client.dateClientAcquired) return false
        const acquiredDate = parse(client.dateClientAcquired, "dd/MM/yyyy", new Date())
        if (!isValid(acquiredDate)) return false
        const month = acquiredDate.getMonth() // 0-11
        
        let quarter
        if (month >= 3 && month <= 5) quarter = 1      // Apr, May, Jun
        else if (month >= 6 && month <= 8) quarter = 2 // Jul, Aug, Sep
        else if (month >= 9 && month <= 11) quarter = 3 // Oct, Nov, Dec
        else quarter = 4                               // Jan, Feb, Mar
        
        return quarter === Number.parseInt(selectedQuarter)
      })
    }

    // 5. General Field/Value filter
    // 5. General Field/Value filter
    if (sortByField && sortByValue) {
  const parseDate = (dateStr) => {
    if (!dateStr) return null
    try {
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/')
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      return new Date(dateStr)
    } catch { return null }
  }

  results = results.filter((client) => {
    if (sortByField === "franchiseeName" || sortByField === "teamLeader") {
      const normalizedSortByValue = sortByValue.trim().replace(/\s+/g, " ").toLowerCase()

      // Build all allocations with dates
      const allAllocations = [
        { franchisee: client.franchiseeName, teamLeader: client.teamLeader, date: client.dateOfClientAllocation || null }
      ]

      if (client.reallocationStatus === "Yes" && client.newFranchisee) {
        allAllocations.push({
          franchisee: client.newFranchisee,
          teamLeader: client.newTeamLeader,
          date: client.dateOfClientReallocation || null
        })
      }

      const rawAdditional = client.additionalReallocations || client.additionalReallocation
      let additionalArr = []
      if (Array.isArray(rawAdditional)) additionalArr = rawAdditional
      else if (typeof rawAdditional === 'string') { try { additionalArr = JSON.parse(rawAdditional) } catch {} }

      additionalArr.forEach(r => {
        if (r && r.newFranchisee) {
          allAllocations.push({ franchisee: r.newFranchisee, teamLeader: r.newTeamLeader, date: r.date || null })
        }
      })

      allAllocations.sort((a, b) => {
        const dA = parseDate(a.date), dB = parseDate(b.date)
        if (!dA && !dB) return 0
        if (!dA) return -1
        if (!dB) return 1
        return dA - dB
      })

      const current = allAllocations[allAllocations.length - 1]
      const currentVal = sortByField === "franchiseeName" ? current?.franchisee : current?.teamLeader
      const normalizedClientVal = (currentVal || "").trim().replace(/\s+/g, " ").toLowerCase()
      return normalizedClientVal === normalizedSortByValue
    }

    // Default logic for other fields
    const val = client[sortByField]
    const normalizedClientVal = val != null && typeof val === "string" ? val.trim().replace(/\s+/g, " ") : val
    const normalizedSortByValue = sortByValue.trim().replace(/\s+/g, " ")
    return (
      normalizedClientVal != null &&
      normalizedClientVal.toString().toLowerCase() === normalizedSortByValue.toLowerCase()
    )
  })
}

    // 6. Company Status filter
    if (selectedCompanyStatus !== "All") {
      results = results.filter(
        (client) => client.status && client.status.toString().toLowerCase() === selectedCompanyStatus.toLowerCase(),
      )
    }

    // **NEW**: 7. Company Category filter
    if (selectedCompanyCategory !== "All") {
      results = results.filter(
        (client) =>
          client.companyCategory &&
          client.companyCategory.toString().toLowerCase() === selectedCompanyCategory.toLowerCase(),
      )
    }

    // 8. Approval Status filter
    if (selectedApprovalStatus !== "All") {
      results = results.filter(
        (client) =>
          client.approvalStatus &&
          client.approvalStatus.toString().toLowerCase() === selectedApprovalStatus.toLowerCase(),
      )
    }

    // --- MODIFICATION START ---
    // 9. Reallocation Status filter (for admin)
    if (currentUser?.role !== "franchisee" && selectedReallocationStatus !== "All") {
      results = results.filter((client) => {
        // Handle clients that might not have the property by defaulting to "No"
        const status = client.reallocationStatus || "No"
        return status === selectedReallocationStatus
      })
    }
    // --- MODIFICATION END ---

    // --- MODIFICATION: ADD STATE FOR DATE RANGE FILTER ---
    // 10. Date Range filter (by data entry date)
   // --- MODIFICATION: UPDATED TO FILTER BY dateClientAcquired INSTEAD OF TIMESTAMP ---
    // 10. Date Range filter (by Business Acquisition Date)
    if (filterFromDate || filterToDate) {
      const fromDate = filterFromDate ? parse(filterFromDate, "dd/MM/yyyy", new Date()) : null
      const toDate = filterToDate ? parse(filterToDate, "dd/MM/yyyy", new Date()) : null

      if (isValid(fromDate)) {
        fromDate.setHours(0, 0, 0, 0)
      }
      if (isValid(toDate)) {
        toDate.setHours(23, 59, 59, 999)
      }

      results = results.filter((client) => {
        // Changed target field from timestamp to dateClientAcquired
        const acquiredDateStr = client.dateClientAcquired
        if (!acquiredDateStr) return false

        // Parse the dd/MM/yyyy string into a Date object for comparison
        const acquiredDate = parse(acquiredDateStr, "dd/MM/yyyy", new Date())
        if (!isValid(acquiredDate)) return false

        const isAfterFrom = fromDate && isValid(fromDate) ? acquiredDate >= fromDate : true
        const isBeforeTo = toDate && isValid(toDate) ? acquiredDate <= toDate : true

        return isAfterFrom && isBeforeTo
      })
    }
    // --- END MODIFICATION ---
    // --- END MODIFICATION ---

    // Always sort the final results alphabetically by company name
    setClients(results)
    setFilteredClients(results)
  }, [
    searchTerm,
    selectedFinancialYear,
    selectedMonth,
    selectedQuarter,
    sortByField,
    sortByValue,
    selectedCompanyStatus,
    selectedCompanyCategory,
    selectedApprovalStatus,
    selectedReallocationStatus, // Added dependency
    currentUser, // Added dependency
    allClients,
    filterFromDate, // Added dependency
    filterToDate, // Added dependency
  ])

  // --- MODIFICATION START ---
  const fetchClients = async (loggedInUser) => {
    try {
      setLoading(true)
      const response = await fetch("https://api.sarthi360.in/api/clients_info")

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Fetch clients error:", response.status, errorText)
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const rawData = await response.json()

      // --- NEW MODIFICATION: HIDE DELETED DATA FROM UI ---
      // We filter out any record where status is 'deleted'.
const data = rawData.filter(client => client.status !== "deleted");
setAllClientsForDuplicateCheck(data);
      // ---------------------------------------------------

      // Sort the data to show the most recent entries first (by descending ID)
      const sortedData = data.sort((a, b) => b.id - a.id)

      let finalData = sortedData
      
      if (loggedInUser) {
        // --- MODIFICATION: ALLOW KOMAL BHANUSHALI TO VIEW ALL DATA ---
        const userName = normalizeName(loggedInUser.name);
        if (userName !== "komal bhanushali") {
            const userDesignation = (loggedInUser.designation || "").toLowerCase();
            
            // Define Specific Checks
            const isListedTeamLeader = isSpecifiedTeamLeader(loggedInUser);
            const isTLDesignation = userDesignation.includes("team leader");
            
            const isListedBDMember = isSpecifiedBDMember(loggedInUser);
            const isBDDesignation = userDesignation.includes("bd") || userDesignation.includes("business development");

            // PRIORITY 1: Team Leader
            if ((isListedTeamLeader || isTLDesignation) && loggedInUser.role !== 'admin') {
                finalData = sortedData.filter(client => {
                    // Check normal assignment
                    const matchesTL = isNameMatch(loggedInUser.name, client.teamLeader);
                    
                    // Check BD Member fields (singular/plural/variations) - TLs often act as BDs too
                    const matchesBD = 
                        isNameMatch(loggedInUser.name, client.bdMembersName) || 
                        isNameMatch(loggedInUser.name, client.bdMemberName) ||
                        isNameMatch(loggedInUser.name, client.businessDevelopment) ||
                        isNameMatch(loggedInUser.name, client.allocatedTo);
                    
                    // Check Reallocation
                    const isReallocated = client.reallocationStatus === "Yes";
                    const matchesNewTL = isReallocated && isNameMatch(loggedInUser.name, client.newTeamLeader);

                    return matchesTL || matchesBD || matchesNewTL;
                });
            }
            // PRIORITY 2: Franchisee (Only runs if Priority 1 didn't match)
       else if (loggedInUser.role === "franchisee" && loggedInUser.franchiseeName) {
  const parseDate = (dateStr) => {
    if (!dateStr) return null
    try {
      // Handle both dd/MM/yyyy and yyyy-MM-dd formats
      if (dateStr.includes('/')) {
        const parts = dateStr.split('/')
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
      }
      return new Date(dateStr)
    } catch { return null }
  }

  finalData = sortedData
    .filter((client) => {
      const userFranchiseName = loggedInUser.franchiseeName

      // Build all allocation states with dates
      const allAllocations = [
        { franchisee: client.franchiseeName, date: client.dateOfClientAllocation || null }
      ]

      if (client.reallocationStatus === "Yes" && client.newFranchisee) {
        allAllocations.push({
          franchisee: client.newFranchisee,
          date: client.dateOfClientReallocation || null
        })
      }

      const rawAdditional = client.additionalReallocations || client.additionalReallocation
      let additionalArr = []
      if (Array.isArray(rawAdditional)) additionalArr = rawAdditional
      else if (typeof rawAdditional === 'string') { try { additionalArr = JSON.parse(rawAdditional) } catch {} }

      additionalArr.forEach(r => {
        if (r && r.newFranchisee) {
          allAllocations.push({ franchisee: r.newFranchisee, date: r.date || null })
        }
      })

      // Sort ascending — latest date = current owner
      allAllocations.sort((a, b) => {
        const dA = parseDate(a.date), dB = parseDate(b.date)
        if (!dA && !dB) return 0
        if (!dA) return -1
        if (!dB) return 1
        return dA - dB
      })

      const currentOwner = allAllocations[allAllocations.length - 1]
      return currentOwner && currentOwner.franchisee === userFranchiseName
    })
    .map((client) => {
      const parseDate = (dateStr) => {
        if (!dateStr) return null
        try {
          if (dateStr.includes('/')) {
            const parts = dateStr.split('/')
            return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
          }
          return new Date(dateStr)
        } catch { return null }
      }

      const allAllocations = [
        { franchisee: client.franchiseeName, teamLeader: client.teamLeader, date: client.dateOfClientAllocation || null }
      ]

      if (client.reallocationStatus === "Yes" && client.newFranchisee) {
        allAllocations.push({
          franchisee: client.newFranchisee,
          teamLeader: client.newTeamLeader,
          date: client.dateOfClientReallocation || null
        })
      }

      const rawAdditional = client.additionalReallocations || client.additionalReallocation
      let additionalArr = []
      if (Array.isArray(rawAdditional)) additionalArr = rawAdditional
      else if (typeof rawAdditional === 'string') { try { additionalArr = JSON.parse(rawAdditional) } catch {} }

      additionalArr.forEach(r => {
        if (r && r.newFranchisee) {
          allAllocations.push({ franchisee: r.newFranchisee, teamLeader: r.newTeamLeader, date: r.date || null })
        }
      })

      allAllocations.sort((a, b) => {
        const dA = parseDate(a.date), dB = parseDate(b.date)
        if (!dA && !dB) return 0
        if (!dA) return -1
        if (!dB) return 1
        return dA - dB
      })

      const latest = allAllocations[allAllocations.length - 1]

      return {
        ...client,
        franchiseeName: latest.franchisee,
        teamLeader: latest.teamLeader,
        dateOfClientAllocation: latest.date || client.dateOfClientAllocation
      }
    })
}
            // PRIORITY 3: BD Member (Only runs if Priority 1 & 2 didn't match)
            else if ((isListedBDMember || isBDDesignation) && loggedInUser.role !== 'admin') {
                 finalData = sortedData.filter(client => {
                    // Same filtering logic as TL, checking strictly BD or TL fields if they are assigned there
                    const matchesTL = isNameMatch(loggedInUser.name, client.teamLeader);
                    
                    const matchesBD = 
                        isNameMatch(loggedInUser.name, client.bdMembersName) || 
                        isNameMatch(loggedInUser.name, client.bdMemberName) ||
                        isNameMatch(loggedInUser.name, client.businessDevelopment) ||
                        isNameMatch(loggedInUser.name, client.allocatedTo);
                    
                    const isReallocated = client.reallocationStatus === "Yes";
                    const matchesNewTL = isReallocated && isNameMatch(loggedInUser.name, client.newTeamLeader);

                    return matchesTL || matchesBD || matchesNewTL;
                });
            }
        }
      }

      console.log("Fetched and processed clients data:", finalData)
      setClients(finalData)
      setAllClients(finalData) // Set the master list to the potentially filtered data
      setFilteredClients(finalData)
      setLoading(false)
    } catch (error) {
      console.error("Error fetching clients:", error)
      alert(`Error fetching clients: ${error.message}`)
      setLoading(false)
    }
  }
  // --- MODIFICATION END ---

  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value)
  }

  // ... (Rest of the file remains unchanged)
  const handleAddFinancialYear = () => {
    if (newFinancialYear.match(/^\d{4}-\d{4}$/)) {
      if (!availableFinancialYears.includes(newFinancialYear)) {
        const updatedYears = [...availableFinancialYears, newFinancialYear].sort()
        setAvailableFinancialYears(updatedYears)
        setSelectedFinancialYear(newFinancialYear)
      } else {
        alert("This financial year is already in the list.")
        setSelectedFinancialYear(newFinancialYear)
      }
      setShowAddFinancialYearModal(false)
      setNewFinancialYear("")
    } else {
      alert("Please enter a valid year format (e.g., 2025-2026).")
    }
  }
const handleSortByFieldChange = (field) => {
  setSortByField(field)
  setSortByValue("") 
  if (field) {
    const parseDate = (dateStr) => {
      if (!dateStr) return null
      try {
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/')
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        }
        return new Date(dateStr)
      } catch { return null }
    }

    const getCurrentOwner = (client, field) => {
      // Build all allocations with dates
      const allAllocations = [
        { 
          franchisee: client.franchiseeName, 
          teamLeader: client.teamLeader,
          date: client.dateOfClientAllocation || null 
        }
      ]

      if (client.reallocationStatus === "Yes" && client.newFranchisee) {
        allAllocations.push({
          franchisee: client.newFranchisee,
          teamLeader: client.newTeamLeader,
          date: client.dateOfClientReallocation || null
        })
      }

      const rawAdditional = client.additionalReallocations || client.additionalReallocation
      let additionalArr = []
      if (Array.isArray(rawAdditional)) additionalArr = rawAdditional
      else if (typeof rawAdditional === 'string') { 
        try { additionalArr = JSON.parse(rawAdditional) } catch {} 
      }

      additionalArr.forEach(r => {
        if (r && r.newFranchisee) {
          allAllocations.push({ 
            franchisee: r.newFranchisee, 
            teamLeader: r.newTeamLeader,
            date: r.date || null 
          })
        }
      })

      // Sort ascending — latest date = current owner
      allAllocations.sort((a, b) => {
        const dA = parseDate(a.date), dB = parseDate(b.date)
        if (!dA && !dB) return 0
        if (!dA) return -1
        if (!dB) return 1
        return dA - dB
      })

      const current = allAllocations[allAllocations.length - 1]
      return field === "franchiseeName" ? current?.franchisee : current?.teamLeader
    }

    const uniqueMap = new Map()
    allClients.forEach((client) => {
      let displayVal = client[field]

      if (field === "franchiseeName" || field === "teamLeader") {
        displayVal = getCurrentOwner(client, field)
      }

      if (displayVal && typeof displayVal === "string" && displayVal.trim() !== "") {
        const normalizedValue = displayVal.trim().replace(/\s+/g, " ")
        const key = normalizedValue.toLowerCase()
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, normalizedValue)
        }
      }
    })
    
    const uniqueValues = Array.from(uniqueMap.values()).sort()
    if (field === "franchiseeName") {
      const formattedOptions = uniqueValues.map((val) => {
        const ownerName = franchiseeDetailsMap[val]
        return {
          value: val, 
          label: ownerName ? `${val} / ${ownerName}` : val, 
        }
      })
      setSortByOptions(formattedOptions)
    } else {
      setSortByOptions(uniqueValues)
    }
  } else {
    setSortByOptions([])
  }
}

  const handleResetFilters = () => {
    setSearchTerm("")
    setSelectedFinancialYear("All Years")
    setSelectedMonth("All Months")
    setSelectedQuarter("All Quarters")
    setSortByField("")
    setSortByValue("")
    setSortByOptions([])
    setSelectedCompanyStatus("All")
    setSelectedCompanyCategory("All")
    setSelectedApprovalStatus("All")
    setSelectedReallocationStatus("All")
    setFilterFromDate("")
    setFilterToDate("")
  }

  const handleAddClient = async (clientData) => {
    try {
      console.log("Saving client data:", clientData)
      
      // 1. Prepare the data for the Client Info table
      const preparedData = {
        companyName: clientData.companyName || null,
        companyLogo: clientData.companyLogo || null,
        bdMembersName: clientData.bdMembersName || null,
        address: clientData.address || null,
        country: clientData.country || null,
        pinCode: clientData.pinCode || null,
        locationArea: clientData.locationArea || null,
        city: clientData.city || null,
        state: clientData.state || null,
        industry: clientData.industry || null,
        subIndustry: clientData.subIndustry || null,
        tags: clientData.tags || null,
        website: clientData.website || null,
        gstNumber: clientData.gstNumber || null,
        yearOfEstablishment: clientData.yearOfEstablishment ? String(clientData.yearOfEstablishment) : null, 
        numberOfEmployees: clientData.numberOfEmployees || null,
        companyConstitution: clientData.companyConstitution || null,
        contactPersonName: clientData.contactPersonName || null,
        contactDesignation: clientData.contactDesignation || null,
        contactStatus: clientData.contactStatus || "Active",
        contactPhone: clientData.contactPhone || null,
        contactEmail: clientData.contactEmail || null,
        placementFees: clientData.placementFees || null,
        additionalPlacementFees: clientData.additionalPlacementFees || "No",
        percentage: clientData.percentage || null,
        revisedPlacementFees: clientData.revisedPlacementFees || null,
        revisedPlacementFeesDate: clientData.revisedPlacementFeesDate || null,
        creditPeriod: clientData.creditPeriod || null,
        replacementPeriod: clientData.replacementPeriod || null,
        companyCategory: clientData.companyCategory || null,
        companyStatus: clientData.companyStatus || null,
        status: clientData.status || "active",
        approvalStatus: clientData.approvalStatus || null,
        remarks: clientData.remarks || null,
        prospectOptions: clientData.prospectOptions || {
          noRequirement: false,
          notAgreeingToTerms: false,
          needToContactAgain: false,
          noVendorRequired: false,
        },
        contactDate: clientData.contactDate || null,
        blacklistedBy: clientData.blacklistedBy || null,
        blacklistedReason: clientData.blacklistedReason || null,
        blacklistedApprovedBy: clientData.blacklistedApprovedBy || null,
        dateOfRevivalCall: clientData.dateOfRevivalCall || null,
        nameOfExecutive: clientData.nameOfExecutive || null,
        statusOfCall: clientData.statusOfCall || null,
        emeet: clientData.emeet || "No",
        revivalRemarks: clientData.revivalRemarks || null,
        updated: clientData.updated || "No",
        dateOfDataUpdate: clientData.dateOfDataUpdate || null,
        nameOfExecutiveUpdate: clientData.nameOfExecutiveUpdate || null,
        additionalCompanyNames: clientData.additionalCompanyNames || null,
        additionalGstNumbers: clientData.additionalGstNumbers || null,
        additionalContactPersons: clientData.additionalContactPersons || null,
        additionalRevivalCalls: clientData.additionalRevivalCalls || null,
        directorNames: clientData.directorNames || null,
        teamLeader: clientData.teamLeader || null,
        franchiseeName: clientData.franchiseeName || null,
        dateClientAcquired: clientData.dateClientAcquired || null,
        dateOfClientAllocation: clientData.dateOfClientAllocation || null,
        reallocationStatus: clientData.reallocationStatus || "No",
        dateOfClientReallocation: clientData.dateOfClientReallocation || null,
        newFranchisee: clientData.newFranchisee || null,
        newTeamLeader: clientData.newTeamLeader || null,
        additionalReallocations: clientData.additionalReallocations || null,
        additionalAddresses: clientData.additionalAddresses || null,
        additionalUpdateCalls: clientData.additionalUpdateCalls || null,
      }

      if (editingClient && editingClient.id) {
        // --- CLIENT UPDATE LOGIC ---
        if (editingClient.updated === "Yes") {
            const newUpdateEntry = {
                id: Date.now(),
                date: format(new Date(), "dd/MM/yyyy"),
                executive: currentUser?.name || "Unknown"
            };
            const currentAdditional = Array.isArray(clientData.additionalUpdateCalls) ? clientData.additionalUpdateCalls : [];
            preparedData.additionalUpdateCalls = [...currentAdditional, newUpdateEntry];
            preparedData.nameOfExecutiveUpdate = editingClient.nameOfExecutiveUpdate;
            preparedData.dateOfDataUpdate = editingClient.dateOfDataUpdate;
        } else {
            preparedData.nameOfExecutiveUpdate = currentUser?.name || null;
            preparedData.dateOfDataUpdate = format(new Date(), "dd/MM/yyyy");
        }
        preparedData.updated = "Yes"

        // Update Client Database
        const response = await fetch(`https://api.sarthi360.in/api/clients_info/${editingClient.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(preparedData),
        })

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        // --- START OF CROSS-FORM SYNCHRONIZATION (LEGAL, ENQUIRY, INVOICE) ---
        try {
          const oldCompanyName = editingClient.companyName.trim().toLowerCase();

          // 1. Sync to LEGAL FORM
          const legalRes = await fetch("https://api.sarthi360.in/legals_info");
          if (legalRes.ok) {
            const legals = await legalRes.json();
            const legalRecord = legals.find(l => l.companyName && l.companyName.trim().toLowerCase() === oldCompanyName);
            if (legalRecord) {
              const toDbDate = (str) => (str && str.includes('/') ? str.split('/').reverse().join('-') : null);
              const syncLegalData = {
                companyName: preparedData.companyName, address: preparedData.address, city: preparedData.city,
                state: preparedData.state, country: preparedData.country, pinCode: preparedData.pinCode,
                industry: preparedData.industry, subIndustry: preparedData.subIndustry, gstNo: preparedData.gstNumber,
                website: preparedData.website, status: preparedData.status ? preparedData.status.toUpperCase() : null,
                dateOfClientAcquired: toDbDate(preparedData.dateClientAcquired), contactPersonName: preparedData.contactPersonName,
                designation: preparedData.contactDesignation, contactPhoneNumber: preparedData.contactPhone,
                contactEmailId: preparedData.contactEmail, placementFees: preparedData.placementFees,
                creditPeriod: preparedData.creditPeriod, replacementPeriod: preparedData.replacementPeriod,
                bdMembersName: preparedData.bdMembersName, teamLeader: preparedData.teamLeader, nameOfFranchisee: preparedData.franchiseeName
              };
              await fetch(`https://api.sarthi360.in/legals_info/${legalRecord.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(syncLegalData)
              });
            }
          }

          // 2. Sync to ENQUIRY FORM
          const enquiryRes = await fetch("https://api.sarthi360.in/api/enquiries");
          if (enquiryRes.ok) {
            const enquiriesData = await enquiryRes.json();
            const enquiries = enquiriesData.data || enquiriesData;
            const matchingEnquiries = enquiries.filter(e => e.companyName && e.companyName.trim().toLowerCase() === oldCompanyName);
            
            for (const enquiry of matchingEnquiries) {
              const syncEnquiryData = {
                companyName: preparedData.companyName, addressLine1: preparedData.address, city: preparedData.city,
                state: preparedData.state, pinCode: preparedData.pinCode, gstNo: preparedData.gstNumber,
                industry: preparedData.industry, subIndustry: preparedData.subIndustry, hrExecutiveName: preparedData.contactPersonName,
                designation: preparedData.contactDesignation, mobileNo: preparedData.contactPhone, emailId: preparedData.contactEmail,
                creditPeriod: preparedData.creditPeriod, replacementPeriod: preparedData.replacementPeriod, placementFees: preparedData.placementFees,
                website: preparedData.website
              };
              await fetch(`https://api.sarthi360.in/api/enquiries/${enquiry.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(syncEnquiryData)
              });
            }
          }

          // 3. Sync to INVOICE FORM
          const invoiceRes = await fetch("https://api.sarthi360.in/api/Invoice");
          if (invoiceRes.ok) {
            const invoices = await invoiceRes.json();
            const matchingInvoices = invoices.filter(i => i.companyName && i.companyName.trim().toLowerCase() === oldCompanyName);
            
            for (const inv of matchingInvoices) {
              const syncInvoiceData = {
                companyName: preparedData.companyName, companyAddress: preparedData.address, companyCity: preparedData.city,
                state: preparedData.state, pinCode: preparedData.pinCode, gstNo: preparedData.gstNumber,
                industry: preparedData.industry, subIndustry: preparedData.subIndustry, contactPerson: preparedData.contactPersonName,
                designation: preparedData.contactDesignation, contactNumber: preparedData.contactPhone, contactEmail: preparedData.contactEmail,
                creditPeriod: preparedData.creditPeriod, replacementPeriod: preparedData.replacementPeriod, serviceCharge: preparedData.placementFees
              };
              await fetch(`https://api.sarthi360.in/api/Invoice/${inv.id}`, {
                method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(syncInvoiceData)
              });
            }
          }
          console.log("Cross-form synchronization completed successfully.");
        } catch (syncErr) {
          console.error("Failed to sync data across forms:", syncErr);
        }
        // --- END OF CROSS-FORM SYNCHRONIZATION ---

        fetchClients(currentUser)
        setEditingClient(null)
        setEditingIndex(null)
        setShowForm(false)
        alert("Client and associated records updated successfully")

      } else {
        // --- NEW CLIENT CREATION ---
        const response = await fetch("https://api.sarthi360.in/api/clients_info", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(preparedData),
        })

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
        
        fetchClients(currentUser)
        setEditingClient(null)
        setShowForm(false)
        alert("Client created successfully!")
      }
    } catch (error) {
      console.error("Detailed error saving client:", error)
      alert(`Error saving client data: ${error.message}`)
    }
  }

  const handleEditClient = async (index) => {
    const clientToEdit = filteredClients[index]
    setEditingClient(clientToEdit)
    setEditingIndex(index)
    setIsViewMode(false) 
    setShowForm(true)
  }

  const handleViewClient = (index) => {
    const clientToView = filteredClients[index]
    setEditingClient(clientToView)
    setEditingIndex(index)
    setIsViewMode(true) 
    setShowForm(true)
  }

  const handleDeleteClient = (client) => {
    setClientToDelete(client)
    setShowDeleteModal(true)
  }

  // --- NEW MODIFICATION: SOFT DELETE LOGIC ---
  const confirmDeleteClient = async () => {
    try {
      if (clientToDelete && clientToDelete.id) {
        // Prepare the note for who deleted it
        const deletionDetails = `Deleted by ${currentUser?.name || "Unknown"} on ${format(new Date(), "dd/MM/yyyy HH:mm")}`;
        
        // We perform a PUT request to update the record status to 'deleted'
        const response = await fetch(`https://api.sarthi360.in/api/clients_info/${clientToDelete.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            ...clientToDelete,
            status: "deleted", // Update status
            remarks: clientToDelete.remarks 
                ? `${clientToDelete.remarks} | ${deletionDetails}` 
                : deletionDetails // Append deletion info to remarks
          })
        })

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
        }

        // Locally remove from state so it disappears from the list
        const updatedClients = allClients.filter((client) => client.id !== clientToDelete.id)
        setAllClients(updatedClients)
        setClients(updatedClients)
        setFilteredClients(updatedClients)
        alert("Client removed successfully (archived in DB).")
      }
      setShowDeleteModal(false)
      setClientToDelete(null)
    } catch (error) {
      console.error("Detailed error deleting client:", error)
      alert(`Error deleting client: ${error.message}.`)
      setShowDeleteModal(false)
      setClientToDelete(null)
    }
  }
  // ------------------------------------------------

 const downloadCSV = () => {
    if (clients.length === 0) {
      alert("No data to download")
      return
    }

    const formatPhone = (phone) => {
      if (!phone) return "";
      // Remove all non-digit characters except + at start
      const cleaned = String(phone).replace(/[^\d+]/g, '');
      // Return with tab prefix to force Excel to treat as text
      return `\t${cleaned}`;
    };

    const headers = [
      "Timestamp",
      "Company Name",
      "Additional Company Names",
      "Company Logo",
      "Date Client Acquired",
      "BD Members",
      "Address",
      "Additional Addresses",
      "Country",
      "Pin Code",
      "Location (Area)",
      "City",
      "State",
      "Industry",
      "Sub Industry",
      "Tags",
      "Company Constitution",
      "Year of Establishment",
      "No. of Employees",
      "GST Number",
      "Additional GST Numbers",
      "Website",
      "Contact Person Name",
      "Contact Designation",
      "Contact Status",
      "Contact Phone",
      "Contact Email",
      "Additional Contact Persons",
      "Placement Fees",
      "Additional Placement Fees",
      "Percentage",
      "Credit Period",
      "Replacement Period",
      "Company Category",
      "Company Status",
      "Approval Status",
      "Prospect - No Requirement",
      "Prospect - Not Agreeing To Terms",
      "Prospect - Need To Contact Again",
      "Prospect - No Vendor Required",
      "Contact Date",
      "Blacklisted By",
      "Blacklisted Reason",
      "Blacklisted Approved By",
      "Remarks",
      "Date Of Revival Call",
      "Name Of Executive",
      "Status Of Call",
      "Additional Revival Calls",
      "E-Meet",
      "Updated",
      "Date Of Data Update",
      "Data Updated By",
      "Additional Update Calls",
      "Director Names",
      "Team Leader",
      "Franchisee Name",
      "Date Of Client Allocation",
      "Reallocation Status",
      "Date Of Client Reallocation",
      "New Franchisee",
      "New Team Leader",
      "Additional Reallocations",
    ]

   const csvRows = clients.map((client) => {
      // Additional Company Names
      const additionalCompanyNamesStr = Array.isArray(client.additionalCompanyNames)
        ? client.additionalCompanyNames.map((c) => c.name).filter(Boolean).join(" | ")
        : ""

      // Additional GST Numbers
      const additionalGstStr = Array.isArray(client.additionalGstNumbers)
        ? client.additionalGstNumbers.map((g) => g.number).filter(Boolean).join(" | ")
        : ""

      // Additional Addresses
      const additionalAddressesStr = Array.isArray(client.additionalAddresses)
        ? client.additionalAddresses
            .map((a) => [a.address, a.locationArea, a.city, a.state, a.country, a.pinCode].filter(Boolean).join(", "))
            .join(" | ")
        : ""

      // Additional Contact Persons - format phones correctly
      const additionalContactsStr = Array.isArray(client.additionalContactPersons)
        ? client.additionalContactPersons
            .map((p) => `${p.name || ""} (${p.designation || ""}) - ${String(p.phone || "").replace(/[^\d+]/g, '')} - ${p.email || ""} [${p.status || ""}]`)
            .join(" | ")
        : ""

      // Additional Revival Calls
      const additionalRevivalStr = Array.isArray(client.additionalRevivalCalls)
        ? client.additionalRevivalCalls
            .map((r) => `Date: ${r.date || ""}, Exec: ${r.executive || ""}, Status: ${r.status || ""}`)
            .join(" | ")
        : ""

      // Additional Update Calls
      const additionalUpdateStr = Array.isArray(client.additionalUpdateCalls)
        ? client.additionalUpdateCalls
            .map((u) => `Date: ${u.date || ""}, By: ${u.executive || ""}`)
            .join(" | ")
        : ""

      // Additional Reallocations
      const additionalReallocStr = Array.isArray(client.additionalReallocations)
        ? client.additionalReallocations
            .map((r) => `Date: ${r.date || ""}, TL: ${r.newTeamLeader || ""}, Franchisee: ${r.newFranchisee || ""}`)
            .join(" | ")
        : ""

      // Prospect Options
      const prospectOpts = client.prospectOptions || {}

      return [
        client.timestamp ? new Date(client.timestamp).toLocaleString() : "",
        client.companyName || "",
        additionalCompanyNamesStr,
        client.companyLogo ? "Yes" : "No",
        client.dateClientAcquired || "",
        client.bdMembersName || "",
        client.address || "",
        additionalAddressesStr,
        client.country || "",
        client.pinCode || "",
        client.locationArea || "",
        client.city || "",
        client.state || "",
        client.industry || "",
        client.subIndustry || "",
        client.tags || "",
        client.companyConstitution || "",
        client.yearOfEstablishment || "",
        client.numberOfEmployees || "",
        client.gstNumber || "",
        additionalGstStr,
        client.website || "",
        client.contactPersonName || "",
        client.contactDesignation || "",
        client.contactStatus || "",
        formatPhone(client.contactPhone),
        client.contactEmail || "",
        additionalContactsStr,
        client.placementFees || "",
        client.additionalPlacementFees || "",
        client.percentage || "",
        client.creditPeriod || "",
        client.replacementPeriod || "",
        client.companyCategory || "",
        client.status || "",
        client.approvalStatus || "",
        prospectOpts.noRequirement ? "Yes" : "No",
        prospectOpts.notAgreeingToTerms ? "Yes" : "No",
        prospectOpts.needToContactAgain ? "Yes" : "No",
        prospectOpts.noVendorRequired ? "Yes" : "No",
        client.contactDate || "",
        client.blacklistedBy || "",
        client.blacklistedReason || "",
        client.blacklistedApprovedBy || "",
        client.remarks || "",
        client.dateOfRevivalCall || "",
        client.nameOfExecutive || "",
        client.statusOfCall || "",
        additionalRevivalStr,
        client.emeet || "",
        client.updated || "",
        client.dateOfDataUpdate || "",
        client.nameOfExecutiveUpdate || "",
        additionalUpdateStr,
        (client.directorNames || []).join("; "),
        client.teamLeader || "",
        client.franchiseeName || "",
        client.dateOfClientAllocation || "",
        client.reallocationStatus || "",
        client.dateOfClientReallocation || "",
        client.newFranchisee || "",
        client.newTeamLeader || "",
        additionalReallocStr,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(",")
    })

    const csvContent = [headers.map((header) => `"${header}"`).join(","), ...csvRows].join("\n")
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "client_data.csv")
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSave = async (clientData) => {
    await handleAddClient(clientData)
    fetchClients(currentUser)
  }

  const existingCompanyNames = allClientsForDuplicateCheck
    .filter((client) => client.id !== editingClient?.id)
    .map((client) => client.companyName)

  if (showForm) {
    return (
     <ClientDataForm
        onSave={handleSave}
        onCancel={() => {
          setShowForm(false)
          setEditingClient(null)
          setIsViewMode(false) 
        }}
        initialData={editingClient}
        userPermissions={userPermissions}
        currentUser={currentUser}
        existingCompanyNames={existingCompanyNames}
        isViewMode={isViewMode} 
        setIsViewMode={setIsViewMode} 
        allClients={allClientsForDuplicateCheck}
        preloadedEmployees={preloadedEmployees}
        loadingPreloadedEmployees={loadingPreloadedEmployees}
      />
    )
  }

  return (
    <div className="min-h-screen bg-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-purple-900 mb-6">Client Data Management</h1>

        {showForm ? (
          <ClientDataForm
        onSave={handleSave}
        onCancel={() => {
          setShowForm(false)
          setEditingClient(null)
          setIsViewMode(false) 
        }}
        initialData={editingClient}
        userPermissions={userPermissions}
        currentUser={currentUser}
        existingCompanyNames={existingCompanyNames}
        isViewMode={isViewMode} 
        setIsViewMode={setIsViewMode} 
        allClients={allClientsForDuplicateCheck}
        preloadedEmployees={preloadedEmployees}
        loadingPreloadedEmployees={loadingPreloadedEmployees}
      />
        ) : (
          <>
            <div className="min-h-screen bg-gray-50 p-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                <div>
                  <h1 className="text-2xl font-bold text-purple-800 mt-5">
                    Client Data ({filteredClients.length})
                  </h1>
                  <p className="text-gray-500 text-sm">All the company clients are listed here</p>
                </div>
              </div>

              {/* Search and New Filter Section */}
              <div className="mb-6 space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                  <div className="relative w-full md:w-auto md:flex-grow">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search by company, contact, etc."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      value={searchTerm}
                      onChange={handleSearchChange}
                    />
                  </div>
                  
                  {/* --- MODIFICATION: ADD CLIENT BUTTON VISIBLE FOR TLs EVEN IF ROLE IS FRANCHISEE --- */}
                  {(currentUser?.role !== "franchisee" || isSpecifiedTeamLeader(currentUser)) && (
                    <button
                      className="w-full md:w-auto bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-md flex items-center justify-center flex-shrink-0"
                      onClick={() => {
                        setEditingClient(null)
                        setEditingIndex(null)
                        setIsViewMode(false) 
                        setShowForm(true)
                      }}
                    >
                      <FiPlus className="mr-2" size={16} />
                      Add Client
                    </button>
                  )}
                  {/* --- MODIFICATION END --- */}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-12 gap-3 items-end">
                  <select
                    value={selectedFinancialYear}
                    onChange={(e) => {
                      if (e.target.value === "add_new") {
                        setShowAddFinancialYearModal(true)
                      } else {
                        setSelectedFinancialYear(e.target.value)
                      }
                    }}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All Years">All Years</option>
                    {availableFinancialYears.map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                    <option value="add_new" className="text-purple-600 font-semibold">
                      + Add Financial Year
                    </option>
                  </select>

                 <select
  value={selectedMonth}
  onChange={(e) => setSelectedMonth(e.target.value)}
  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
>
  <option value="All Months">All Months</option>
  {financialMonths.map((month) => (
    <option key={month.index} value={month.index}>
      {month.name}
    </option>
  ))}
</select>

                  <select
                    value={selectedQuarter}
                    onChange={(e) => setSelectedQuarter(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All Quarters">All Quarters</option>
                    <option value="1">Q1 (Apr-Jun)</option>
                    <option value="2">Q2 (Jul-Sep)</option>
                    <option value="3">Q3 (Oct-Dec)</option>
                    <option value="4">Q4 (Jan-Mar)</option>
                  </select>

                  <select
                    value={sortByField}
                    onChange={(e) => handleSortByFieldChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="">Sort By...</option>
                    {sortableFields.map((field) => (
                      <option key={field.value} value={field.value}>
                        {field.label}
                      </option>
                    ))}
                  </select>

                  {sortByField && (
                    <select
                      value={sortByValue}
                      onChange={(e) => setSortByValue(e.target.value)}
                      disabled={!sortByField || sortByOptions.length === 0}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                    >
                      <option value="">{sortByOptions.length > 0 ? "Select Value..." : "No options"}</option>
                      {sortByOptions.map((option) => {
                        const value = typeof option === "object" ? option.value : option
                        const label = typeof option === "object" ? option.label : option
                        return (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        )
                      })}
                    </select>
                  )}

                  <select
                    value={selectedCompanyStatus}
                    onChange={(e) => setSelectedCompanyStatus(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Company Status</option>
                    {companyStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ")}
                      </option>
                    ))}
                  </select>

                  <select
                    value={selectedCompanyCategory}
                    onChange={(e) => setSelectedCompanyCategory(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="All">All Company Categories</option>
                    {companyCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>

                  {userPermissions.approvalStatusAccess && (
                    <select
                      value={selectedApprovalStatus}
                      onChange={(e) => setSelectedApprovalStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="All">All Approval Status</option>
                      {approvalStatusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </option>
                      ))}
                    </select>
                  )}
                  {currentUser?.role !== "franchisee" && (
                    <select
                      value={selectedReallocationStatus}
                      onChange={(e) => setSelectedReallocationStatus(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="All">All Reallocations</option>
                      <option value="Yes">Reallocated</option>
                      <option value="No">Not Reallocated</option>
                    </select>
                  )}

                  <div className="lg:col-span-2 flex items-end gap-3 mr-4">
                    <DatePicker
                      label="Entry Date From"
                      name="filterFromDate"
                      value={filterFromDate}
                      handleDateChange={(name, date) => setFilterFromDate(date ? format(date, "dd/MM/yyyy") : "")}
                    />
                    <DatePicker
                      label="Entry Date To"
                      name="filterToDate"
                      value={filterToDate}
                      handleDateChange={(name, date) => setFilterToDate(date ? format(date, "dd/MM/yyyy") : "")}
                    />
                  </div>

                  <div className="lg:pl-4">
                    <button
                      onClick={handleResetFilters}
                      className="w-full px-4 py-2 text-sm bg-white border border-gray-300 rounded-md shadow-sm text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      Reset Filters
                    </button>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="border-2 border-dashed border-gray-300 rounded-md p-12 flex flex-col items-center justify-center">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center">
                    <svg
                      className="animate-spin h-6 w-6 text-gray-500"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                  </div>
                  <p className="text-gray-600 mt-4">Loading client data...</p>
                </div>
              ) : filteredClients.length === 0 ? (
                <div
                  // --- MODIFICATION: DISABLE ADD CLICK FOR FRANCHISEE ---
                  className={`border-2 border-dashed border-gray-300 rounded-md p-12 flex flex-col items-center justify-center ${(currentUser?.role !== "franchisee" || isSpecifiedTeamLeader(currentUser)) ? "cursor-pointer hover:bg-gray-50" : ""}`}
                  onClick={() => {
                    if (currentUser?.role !== "franchisee" || isSpecifiedTeamLeader(currentUser)) {
                        setEditingClient(null)
                        setEditingIndex(null)
                        setIsViewMode(false) 
                        setShowForm(true)
                    }
                  }}
                >
                  <div className="h-12 w-12 rounded-full border-2 border-gray-300 flex items-center justify-center mb-4">
                    <FiPlus size={20} />
                  </div>
                  <p className="text-gray-600">No clients found. {(currentUser?.role !== "franchisee" || isSpecifiedTeamLeader(currentUser)) && "Click here to add a client."}</p>
                </div>
              ) : (
                <div className="bg-white rounded-md shadow-sm overflow-hidden">
                  <div className="flex justify-end p-4 border-b border-gray-200">
                    {/* --- MODIFICATION START --- */}
                    {/* Updated condition to hide CSV download for specified users */}
                    {currentUser?.role !== "franchisee" && !isSpecifiedTeamLeader(currentUser) && !isSpecifiedBDMember(currentUser) && (
                      <button
                        onClick={downloadCSV}
                        className="bg-white border border-gray-300 rounded p-2 cursor-pointer text-purple-600 hover:bg-purple-50 transition-colors mr-2"
                        title="Download as CSV"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                          <polyline points="7 10 12 15 17 10"></polyline>
                          <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                      </button>
                    )}
                    {/* --- MODIFICATION END --- */}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                            COMPANY NAME
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                            CONTACT NO
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                            CITY
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                            INDUSTRY
                          </th>
                          <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
  {isSpecifiedTeamLeader(currentUser) || (currentUser?.designation || "").toLowerCase().includes("team leader") 
    ? "EMAIL ID" 
    : "UPDATED BY"}
</th>
                          <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-6">
                            ACTION
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredClients.map((client, index) => (
                          <tr
                            key={client.id || index}
                            className="border-b border-gray-200 hover:bg-gray-50 cursor-pointer"
                            onClick={() => handleViewClient(index)}
                            title="click to view"
                          >
                          <td className="py-4 px-6 text-sm text-gray-900 max-w-[250px]">
  <div className="font-medium truncate" title={client.companyName}>
    {client.companyName}
  </div>
  {/* Additional Company Names */}
  {client.additionalCompanyNames && client.additionalCompanyNames.length > 0 && (
    <div
      className="text-xs text-gray-500 truncate"
      title={client.additionalCompanyNames.map((c) => c.name).join(", ")}
    >
      {client.additionalCompanyNames.map((c) => c.name).join(", ")}
    </div>
  )}

  {currentUser?.role !== "franchisee" && client.reallocationStatus === "Yes" && (() => {
    const parseDate = (dateStr) => {
      if (!dateStr) return null
      try {
        if (dateStr.includes('/')) {
          const parts = dateStr.split('/')
          return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]))
        }
        return new Date(dateStr)
      } catch { return null }
    }

    const raw = client.additionalReallocations || client.additionalReallocation
    let additionalArr = []
    if (Array.isArray(raw)) additionalArr = raw
    else if (typeof raw === 'string') { try { additionalArr = JSON.parse(raw) } catch {} }

    // Build full chronological list: original + reallocation 1 + additional reallocations
    const allAllocations = [
      { 
        franchisee: client.franchiseeName, 
        date: client.dateOfClientAllocation || null, 
        label: "Original" 
      },
      { 
        franchisee: client.newFranchisee, 
        date: client.dateOfClientReallocation || null, 
        label: "Realloc. 1" 
      },
      ...additionalArr.map((r, i) => ({ 
        franchisee: r.newFranchisee, 
        date: r.date || null, 
        label: `Realloc. ${i + 2}` 
      }))
    ].filter(r => r.franchisee) // remove empty entries

    // Sort ascending by date
    allAllocations.sort((a, b) => {
      const dA = parseDate(a.date), dB = parseDate(b.date)
      if (!dA && !dB) return 0
      if (!dA) return -1
      if (!dB) return 1
      return dA - dB
    })

    const currentOwner = allAllocations[allAllocations.length - 1]

    return (
      <div className="mt-0.5 space-y-0.5">
        {allAllocations.map((alloc, idx) => {
          const isCurrent = alloc.franchisee === currentOwner?.franchisee && idx === allAllocations.length - 1
          return (
            <div 
              key={idx} 
              className={`text-xs font-semibold truncate ${isCurrent ? 'text-green-600' : 'text-blue-400'}`}
              title={`${isCurrent ? 'Current' : alloc.label}: ${alloc.franchisee}`}
            >
              {isCurrent 
                ? `✓ Current: ${alloc.franchisee}` 
                : `↳ ${alloc.label}: ${alloc.franchisee}`
              }
            </div>
          )
        })}
      </div>
    )
  })()}
</td>
                            <td className="py-4 px-6 text-sm text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                              {client.contactPhone}
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                              {client.city}
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
                              {client.industry}
                            </td>
                            <td className="py-4 px-6 text-sm text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">
  {isSpecifiedTeamLeader(currentUser) || (currentUser?.designation || "").toLowerCase().includes("team leader") 
    ? client.contactEmail 
    : client.nameOfExecutiveUpdate}
</td>

                            <td className="py-4 px-6 text-sm text-gray-900 flex justify-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleEditClient(index)
                                }}
                                className="text-gray-600 hover:bg-gray-50 p-1 mr-2"
                                title="Edit"
                              >
                                <svg
                                  xmlns="http://www.w3.org/2000/svg"
                                  width="18"
                                  height="18"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                </svg>
                              </button>
                              {(currentUser?.role !== "franchisee" || isSpecifiedTeamLeader(currentUser)) && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleDeleteClient(filteredClients[index])
                                  }}
                                  className="text-red-600 hover:bg-red-50 p-1"
                                  title="Delete"
                                >
                                  <FiTrash2 size={18} />
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              {showDeleteModal && (
                <div className="fixed inset-0 bg-transparent flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-300">
                    <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
                    <p className="mb-6">Are you sure you want to delete this client? This action cannot be undone.</p>
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => setShowDeleteModal(false)}
                        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={confirmDeleteClient}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {showAddFinancialYearModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                  <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
                    <h3 className="text-lg font-semibold text-center mb-4">Add Financial Year</h3>
                    <p className="text-sm text-gray-500 text-center mb-4">Enter the year in YYYY-YYYY format.</p>
                    <input
                      type="text"
                      placeholder="e.g., 2025-2026"
                      value={newFinancialYear}
                      onChange={(e) => setNewFinancialYear(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm mb-4"
                    />
                    <div className="flex justify-end gap-4">
                      <button
                        type="button"
                        onClick={() => setShowAddFinancialYearModal(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddFinancialYear}
                        className="px-4 py-2 border border-transparent rounded-md text-white bg-purple-700 hover:bg-purple-800"
                      >
                        Add Year
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ... (Rest of the file remains unchanged as per instruction)
// [Assuming standard PhoneInput, DatePicker, PincodeInput, SearchableSelect, and ClientDataForm components follow below]

// --- MODIFICATION START ---
// Phone Input Component using react-international-phone - ADD `disabled` PROP
// --- REPLACE YOUR EXISTING PhoneInput COMPONENT IN FRONTEND WITH THIS ---
function PhoneInput({ value, onChange, className = "", required, disabled = false }) {
  return (
    <div className={`${className}`}>
      <ReactPhoneInput
        defaultCountry="in"
        // Directly use the prop value. If null/undefined, default to empty string
        value={value || ""} 
        onChange={onChange}
        disabled={disabled}
        inputClassName="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        required={required}
      />
    </div>
  )
}

// --- MODIFICATION START: REPLACED DateInput WITH DatePicker ---
const DatePicker = ({ label, name, value, handleDateChange, required = false, disabled = false }) => {
  const inputRef = useRef(null)
  const calendarRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value || "")
  const [localDate, setLocalDate] = useState(() => {
    if (value) {
      try {
        return parse(value, "dd/MM/yyyy", new Date())
      } catch (error) {
        return new Date()
      }
    }
    return new Date()
  })

  useEffect(() => {
    setInputValue(value || "")
  }, [value])

  const toggleCalendar = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled) {
      setIsOpen(!isOpen)
    }
  }

  const handleInputChange = (e) => {
    if (!e || !e.target) {
      console.warn("Invalid event object in handleInputChange")
      return
    }

    const rawValue = e.target.value.replace(/[^\d]/g, "")

    const parseSmartDate = (digits) => {
      if (digits.length < 6) return null

      let day, month, year

      if (digits.length === 6) {
        day = Number.parseInt(digits.substring(0, 2), 10)
        month = Number.parseInt(digits.substring(2, 4), 10)
        year = Number.parseInt(digits.substring(4, 6), 10)
        year = year <= 50 ? 2000 + year : 1900 + year
      } else if (digits.length >= 8) {
        day = Number.parseInt(digits.substring(0, 2), 10)
        month = Number.parseInt(digits.substring(2, 4), 10)
        year = Number.parseInt(digits.substring(4, 8), 10)
      } else {
        return null
      }

      if (month > 12) {
        if (day <= 12) {
          ;[day, month] = [month, day]
        } else {
          const originalDigits = digits.substring(0, 4)
          const altDay = Number.parseInt(originalDigits.substring(0, 1), 10)
          const altMonth = Number.parseInt(originalDigits.substring(1, 3), 10)
          if (altDay >= 1 && altDay <= 31 && altMonth >= 1 && altMonth <= 12) {
            day = altDay
            month = altMonth
          } else {
            const altDay2 = Number.parseInt(originalDigits.substring(0, 2), 10)
            const altMonth2 = Number.parseInt(originalDigits.substring(2, 3), 10)
            if (altDay2 >= 1 && altDay2 <= 31 && altMonth2 >= 1 && altMonth2 <= 12) {
              day = altDay2
              month = altMonth2
            }
          }
        }
      }

      if (day > 31) {
        const originalDigits = digits.substring(0, 4)
        const altDay = Number.parseInt(originalDigits.substring(0, 1), 10)
        const altMonth = Number.parseInt(originalDigits.substring(1, 3), 10)
        if (altDay >= 1 && altDay <= 31 && altMonth >= 1 && altMonth <= 12) {
          day = altDay
          month = altMonth
        }
      }

      if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
        return null
      }

      const testDate = new Date(year, month - 1, day)
      if (testDate.getDate() !== day || testDate.getMonth() !== month - 1 || testDate.getFullYear() !== year) {
        return null
      }

      return { day, month, year }
    }

    let formattedValue = ""
    if (rawValue.length > 0) {
      formattedValue += rawValue.substring(0, Math.min(2, rawValue.length))
      if (rawValue.length > 2) {
        formattedValue += "/" + rawValue.substring(2, Math.min(4, rawValue.length))
        if (rawValue.length > 4) {
          formattedValue += "/" + rawValue.substring(4, Math.min(8, rawValue.length))
        }
      }
    }

    if (rawValue.length >= 6) {
      const smartDate = parseSmartDate(rawValue)
      if (smartDate) {
        const correctedDay = smartDate.day.toString().padStart(2, "0")
        const correctedMonth = smartDate.month.toString().padStart(2, "0")
        const correctedYear = smartDate.year.toString()
        formattedValue = `${correctedDay}/${correctedMonth}/${correctedYear}`

        try {
          const date = new Date(smartDate.year, smartDate.month - 1, smartDate.day)
          if (!isNaN(date.getTime())) {
            handleDateChange(name, date)
            setLocalDate(date)
          }
        } catch (error) {
          console.error("Invalid date format:", error)
        }
      }
    }

    setInputValue(formattedValue)

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(formattedValue) && rawValue.length === 8) {
      try {
        const date = parse(formattedValue, "dd/MM/yyyy", new Date())
        if (!isNaN(date.getTime())) {
          handleDateChange(name, date)
          setLocalDate(date)
        }
      } catch (error) {
        console.error("Invalid date format:", error)
      }
    }
  }

  const handleDateSelect = (day) => {
    if (!day) return
    handleDateChange(name, day)
    setInputValue(format(day, "dd/MM/yyyy"))
    setLocalDate(day)
    setIsOpen(false)
  }

  const handleYearChange = (e) => {
    const year = Number.parseInt(e.target.value)
    const newDate = new Date(localDate)
    newDate.setFullYear(year)
    setLocalDate(newDate)
  }

  const handleMonthChange = (e) => {
    const month = Number.parseInt(e.target.value)
    const newDate = new Date(localDate)
    newDate.setMonth(month)
    setLocalDate(newDate)
  }

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [isOpen])

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear()
    const years = []
    for (let year = 1900; year <= currentYear + 50; year++) {
      years.push(year)
    }
    return years
  }

  const generateCalendarDays = (date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()
    const days = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          id={name}
          name={name}
          value={inputValue}
          onChange={handleInputChange}
          placeholder="DD/MM/YYYY"
          required={required}
          disabled={disabled}
          // --- THIS IS THE FIX ---
          className={`w-full h-10 pl-3 pr-10 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 ${
            disabled ? "bg-gray-50" : ""
          }`}
        />

        <button
          type="button"
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
          onClick={toggleCalendar}
          aria-label="Open calendar"
          disabled={disabled}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
        </button>

        {isOpen && (
          <div
            ref={calendarRef}
            className="absolute z-50 bg-white shadow-lg rounded-md border border-gray-200 p-2 w-64 mt-1"
            style={{
              top: "calc(100% + 5px)",
              left: 0,
              boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
            }}
          >
            <div className="flex justify-between items-center mb-2 gap-2">
              <select
                value={localDate.getMonth()}
                onChange={handleMonthChange}
                className="p-1 text-sm border border-gray-200 rounded flex-1"
              >
                {[
                  "January",
                  "February",
                  "March",
                  "April",
                  "May",
                  "June",
                  "July",
                  "August",
                  "September",
                  "October",
                  "November",
                  "December",
                ].map((month, index) => (
                  <option key={month} value={index}>
                    {month}
                  </option>
                ))}
              </select>

              <select
                value={localDate.getFullYear()}
                onChange={handleYearChange}
                className="p-1 text-sm border border-gray-200 rounded flex-1"
              >
                {generateYearOptions().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
                <div key={day} className="text-xs font-medium text-gray-500 p-1">
                  {day}
                </div>
              ))}

              {generateCalendarDays(localDate).map((day, index) => {
                const classes = [
                  "p-1",
                  "text-sm",
                  "rounded-full",
                  day ? "cursor-pointer" : "",
                  day ? "hover:bg-gray-100" : "",
                  day && day.toDateString() === new Date().toDateString() ? "bg-purple-100 text-purple-800" : "",
                ]
                  .filter(Boolean)
                  .join(" ")

                return (
                  <div key={index} className={classes} onClick={() => day && handleDateSelect(day)}>
                    {day ? day.getDate() : ""}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
// --- MODIFICATION END ---

// --- MODIFICATION START ---
// Pincode Input Component - ADDED `disabled` PROP
function PincodeInput({ value, onChange, className = "", country = "India", required, disabled = false, onLocationFetch }) {
  // --- MODIFICATION END ---
  const handleChange = (e) => {
    const newValue = e.target.value.replace(/[^0-9]/g, "")
    const currentCountry = country || "India"
    const maxLength =
      currentCountry.toLowerCase() === "india"
        ? 6
        : currentCountry.toLowerCase() === "usa" || currentCountry.toLowerCase() === "us"
          ? 5
          : 10

    if (newValue.length <= maxLength) {
      onChange(newValue)
    }
  }

  return (
    <div className={`relative w-full ${className || ""}`}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={
          country && country.toLowerCase() === "india"
            ? "Enter 6-digit pincode"
            : country && (country.toLowerCase() === "usa" || country.toLowerCase() === "us")
              ? "Enter 5-digit zipcode"
              : "Enter postal code"
        }
        maxLength={
          country && country.toLowerCase() === "india" ? 6 : country && country.toLowerCase() === "usa" ? 5 : 10
        }
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
        required={required}
        // --- MODIFICATION START ---
        disabled={disabled}
        // --- MODIFICATION END ---
      />
    </div>
  )
}

// --- MODIFICATION START ---
// New Searchable Select Component for Franchisee Dropdowns
const SearchableSelect = ({ options, value, onChange, placeholder, disabled, required, name }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const wrapperRef = useRef(null)

  const selectedOption = options.find((option) => option.value === value)

  useEffect(() => {
    if (isOpen) {
      setSearchTerm(selectedOption ? selectedOption.label : "")
    }
  }, [isOpen, selectedOption])

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [wrapperRef])

  // --- MODIFICATION: ADD AT TOP LOGIC ---
  const filteredOptions = options.filter((option) => option.label.toLowerCase().includes(searchTerm.toLowerCase()))
  
  
  // -------------------------------------

  const handleSelectOption = (option) => {
    // Pass the typed value if it's the "Add new" virtual option
    if (option.value === "ADD_NEW_FROM_SEARCH") {
        onChange("ADD_NEW_FROM_SEARCH", option.actualValue);
    } else {
        onChange(option.value)
    }
    setSearchTerm(option.label)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        // MODIFIED: Changed selectedOption.value to selectedOption.label to show names instead of IDs
        value={isOpen ? searchTerm : selectedOption ? selectedOption.label : ""}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => !disabled && setIsOpen(true)}
        placeholder={placeholder}
        disabled={disabled}
        required={required && !value} 
        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      <input type="hidden" name={name} value={value || ""} />

      {isOpen && (
        <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={`${option.value}-${index}`}
                className={`px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm ${
                  option.value === "custom" || option.value === "add_new" || option.value === "ADD_NEW_FROM_SEARCH" ? "text-purple-600 font-medium" : ""
                }`}
                onMouseDown={() => handleSelectOption(option)} 
              >
                {option.label}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">No options found</div>
          )}
        </div>
      )}
    </div>
  )
}
// --- MODIFICATION END ---

// --- MODIFICATION START ---
// Updated Client Data Form Component with role-based field visibility and duplicate company check
function ClientDataForm({
  onSave,
  onCancel,
  initialData = null,
  userPermissions = {},
  currentUser = null,
  existingCompanyNames = [],
  isViewMode,
  setIsViewMode,
 allClients = [],
  preloadedEmployees = [],
  loadingPreloadedEmployees = false,
}) {
  // --- MODIFICATION END ---
  
  // --- MODIFICATION: CHECK ROLE FOR RESTRICTED ACCESS ---
  // If the user is a specified Team Leader, treat them as having full access, NOT as a restricted franchisee.
  const isFranchisee = currentUser?.role === "franchisee" && !isSpecifiedTeamLeader(currentUser);
  // --- MODIFICATION END ---

  const [customCompanyCategories, setCustomCompanyCategories] = useState([])
  const [franchises, setFranchises] = useState([])
  const [loadingFranchises, setLoadingFranchises] = useState(false)
  const [reallocationFranchises, setReallocationFranchises] = useState([])
  const [loadingReallocationFranchises, setLoadingReallocationFranchises] = useState(false)
  const [employees, setEmployees] = useState([])
  const [showProspectOptions, setShowProspectOptions] = useState(initialData?.status === "prospect" || false)
  const [showContactDate, setShowContactDate] = useState(initialData?.prospectOptions?.needToContactAgain || false)
  const [showBlacklistedFields, setShowBlacklistedFields] = useState(initialData?.status === "blacklisted" || false)
  const [showValidationMessage, setShowValidationMessage] = useState(false)
  const [useCustomFranchisee, setUseCustomFranchisee] = useState(false)
  const [showReallocationFields, setShowReallocationFields] = useState(
    initialData?.reallocationStatus === "Yes" || false,
  )
  // --- MODIFICATION START ---
  // State for the duplicate company name modal
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateClientData, setDuplicateClientData] = useState(null)
  // New state for logo preview
  const [previewLogo, setPreviewLogo] = useState(null)
  // --- MODIFICATION END ---
// ── GEMINI AUTOFILL STATES ───────────────────────────────────────────────
  const [isGeminiFetching, setIsGeminiFetching] = useState(false)
  const [geminiSuggestion, setGeminiSuggestion] = useState(null)
  const [showGeminiModal, setShowGeminiModal] = useState(false)
  const [geminiError, setGeminiError] = useState(null)
   const [isSubmitting, setIsSubmitting] = useState(false)
  // --- ADD THIS LINE BELOW ---
  const isSubmittingRef = useRef(false)
  const triggerGeminiFetch = (companyNameValue) => {
    if (!companyNameValue || companyNameValue.trim().length < 3) return
    if (isViewMode || isFranchisee) return
    setIsGeminiFetching(true)
    setGeminiError(null)
    setTimeout(async () => {
      try {
        const details = await fetchCompanyDetailsFromGemini(companyNameValue.trim())
        if (details) { setGeminiSuggestion(details); setShowGeminiModal(true) }
        else { setGeminiError("Could not fetch details. Please fill in manually."); setTimeout(() => setGeminiError(null), 4000) }
      } catch { setGeminiError("Something went wrong."); setTimeout(() => setGeminiError(null), 4000) }
      finally { setIsGeminiFetching(false) }
    }, 0)
  }

 const applyGeminiSuggestion = () => {
    if (!geminiSuggestion) return;

    // 1. Strict Mapping for Company Constitution to match your <option> values exactly
    const matchConstitution = (aiValue) => {
      if (!aiValue) return "";
      const val = aiValue.toUpperCase();
      
      // Matches "PUBLIC LIMITED" to your dropdown option "LIMITED COMPANY (PUBLIC LISTED)"
      if (val.includes("PUBLIC") || (val.includes("LIMITED") && !val.includes("PRIVATE"))) 
        return "LIMITED COMPANY (PUBLIC LISTED)";
      
      if (val.includes("PRIVATE") || val.includes("PVT")) 
        return "PRIVATE LIMITED COMPANY";
      
      if (val.includes("UNLISTED")) 
        return "LIMITED COMPANY (UNLISTED)";
      
      if (val.includes("LLP") || val.includes("LIMITED LIABILITY")) 
        return "LIMITED LIABILITY PARTNERSHIP";
      
      if (val.includes("PARTNER")) 
        return "PARTNERSHIP";
      
      if (val.includes("PROPRIETOR")) 
        return "PROPRIETORSHIP";
      
      if (val.includes("ONE PERSON") || val.includes("OPC")) 
        return "ONE PERSON COMPANY";
      
      if (val.includes("TRUST")) 
        return "TRUST";
        
      return aiValue; 
    };

    // 2. Find Industry ID from Static List
    const matchedIndustry = STATIC_INDUSTRIES.find(ind =>
      ind.name.toLowerCase().includes((geminiSuggestion.industry || "").toLowerCase()) ||
      (geminiSuggestion.industry || "").toLowerCase().includes(ind.name.toLowerCase())
    );

    setFormData(prev => ({
      ...prev,
      // --- CAPTURE LOGO URL ---
      companyLogo:         prev.companyLogo         || geminiSuggestion.logoUrl             || "",
      
      // --- CAPTURE CONSTITUTION (mapped to dropdown) ---
      companyConstitution: prev.companyConstitution || matchConstitution(geminiSuggestion.companyConstitution) || "",

      // --- CAPTURE GST NUMBER (cleaning formatting) ---
      gstNumber:           prev.gstNumber           || (geminiSuggestion.gstNumber || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || "",

      // --- CAPTURE ALL OTHER FIELDS ---
      address:             prev.address             || geminiSuggestion.address             || "",
      locationArea:        prev.locationArea        || geminiSuggestion.locationArea        || "",
      city:                prev.city                || geminiSuggestion.city                || "",
      state:               prev.state               || geminiSuggestion.state               || "",
      country:             prev.country              || geminiSuggestion.country              || "",
      pinCode:             prev.pinCode              || (geminiSuggestion.pinCode || "").replace(/\D/g, "") || "",
      website:             prev.website              || geminiSuggestion.website              || "",
      yearOfEstablishment: prev.yearOfEstablishment  || geminiSuggestion.yearOfEstablishment  || "",
      industry:            prev.industry             || (matchedIndustry ? String(matchedIndustry.id) : ""),
      contactPersonName:   prev.contactPersonName    || geminiSuggestion.contactPersonName    || "",
      contactDesignation:  prev.contactDesignation   || geminiSuggestion.contactDesignation   || "",
      contactPhone:        prev.contactPhone         || geminiSuggestion.contactPhone         || "",
      contactEmail:        prev.contactEmail         || geminiSuggestion.contactEmail         || "",
      numberOfEmployees:   prev.numberOfEmployees    || geminiSuggestion.numberOfEmployees    || "",
    }));

    // Update the visual Logo preview in the form
    if (geminiSuggestion.logoUrl && !previewLogo) {
      setPreviewLogo(geminiSuggestion.logoUrl);
    }

    setShowGeminiModal(false);
    setGeminiSuggestion(null);
  };
  // ─────────────────────────────────────────────────────────────────────────

  // ── FRANCHISEE RECOMMENDATION STATES ─────────────────────────────────────
  const [franchiseeRecommendations, setFranchiseeRecommendations] = useState([])
  const [loadingRecommendations, setLoadingRecommendations] = useState(false)
  // ─────────────────────────────────────────────────────────────────────────
  // Dynamic fields state
  
  const [additionalCompanyNames, setAdditionalCompanyNames] = useState([])
  // --- NEW: ADDITIONAL GST STATE ---
  const [additionalGstNumbers, setAdditionalGstNumbers] = useState([]) 
  // -------------------------------
  const [additionalContactPersons, setAdditionalContactPersons] = useState([])
  const [additionalRevivalCalls, setAdditionalRevivalCalls] = useState([])
  // **NEW**: State for additional reallocations
  const [additionalReallocations, setAdditionalReallocations] = useState([])

  // **NEW**: State for additional addresses
  const [additionalAddresses, setAdditionalAddresses] = useState([])

  // --- NEW: ADDITIONAL UPDATE CALLS ---
  const [additionalUpdateCalls, setAdditionalUpdateCalls] = useState([])
  // ------------------------------------

  // Add autocomplete state variables
  const [citySuggestions, setCitySuggestions] = useState([])
  const [stateSuggestions, setStateSuggestions] = useState([])
  const [showCitySuggestions, setShowCitySuggestions] = useState(false)
  const [showStateSuggestions, setShowStateSuggestions] = useState(false)

  // --- MODIFICATION START ---
  // Static data for location dropdowns
  const countries = [
    "Afghanistan",
    "Albania",
    "Algeria",
    "Andorra",
    "Angola",
    "Antigua and Barbuda",
    "Argentina",
    "Armenia",
    "Australia",
    "Austria",
    "Azerbaijan",
    "Bahamas",
    "Bahrain",
    "Bangladesh",
    "Barbados",
    "Belarus",
    "Belgium",
    "Belize",
    "Benin",
    "Bhutan",
    "Bolivia",
    "Bosnia and Herzegovina",
    "Botswana",
    "Brazil",
    "Brunei",
    "Bulgaria",
    "Burkina Faso",
    "Burundi",
    "Cabo Verde",
    "Cambodia",
    "Cameroon",
    "Canada",
    "Central African Republic",
    "Chad",
    "Chile",
    "China",
    "Colombia",
    "Comoros",
    "Congo, Democratic Republic of the",
    "Congo, Republic of the",
    "Costa Rica",
    "Cote d'Ivoire",
    "Croatia",
    "Cuba",
    "Cyprus",
    "Czech Republic",
    "Denmark",
    "Djibouti",
    "Dominica",
    "Dominican Republic",
    "Ecuador",
    "Egypt",
    "El Salvador",
    "Equatorial Guinea",
    "Eritrea",
    "Estonia",
    "Eswatini",
    "Ethiopia",
    "Fiji",
    "Finland",
    "France",
    "Gabon",
    "Gambia",
    "Georgia",
    "Germany",
    "Ghana",
    "Greece",
    "Grenada",
    "Guatemala",
    "Guinea",
    "Guinea-Bissau",
    "Guyana",
    "Haiti",
    "Honduras",
    "Hungary",
    "Iceland",
    "India",
    "Indonesia",
    "Iran",
    "Iraq",
    "Ireland",
    "Israel",
    "Italy",
    "Jamaica",
    "Japan",
    "Jordan",
    "Kazakhstan",
    "Kenya",
    "Kiribati",
    "Kosovo",
    "Kuwait",
    "Kyrgyzstan",
    "Laos",
    "Latvia",
    "Lebanon",
    "Lesotho",
    "Liberia",
    "Libya",
    "Liechtenstein",
    "Lithuania",
    "Luxembourg",
    "Madagascar",
    "Malawi",
    "Malaysia",
    "Maldives",
    "Mali",
    "Malta",
    "Marshall Islands",
    "Mauritania",
    "Mauritius",
    "Mexico",
    "Micronesia",
    "Moldova",
    "Monaco",
    "Mongolia",
    "Montenegro",
    "Morocco",
    "Mozambique",
    "Myanmar",
    "Namibia",
    "Nauru",
    "Nepal",
    "Netherlands",
    "New Zealand",
    "Nicaragua",
    "Niger",
    "Nigeria",
    "North Korea",
    "North Macedonia",
    "Norway",
    "Oman",
    "Pakistan",
    "Palau",
    "Palestine",
    "Panama",
    "Papua New Guinea",
    "Paraguay",
    "Peru",
    "Philippines",
    "Poland",
    "Portugal",
    "Qatar",
    "Romania",
    "Russia",
    "Rwanda",
    "Saint Kitts and Nevis",
    "Saint Lucia",
    "Saint Vincent and the Grenadines",
    "Samoa",
    "San Marino",
    "Sao Tome and Principe",
    "Saudi Arabia",
    "Senegal",
    "Serbia",
    "Seychelles",
    "Sierra Leone",
    "Singapore",
    "Slovakia",
    "Slovenia",
    "Solomon Islands",
    "Somalia",
    "South Africa",
    "South Korea",
    "South Sudan",
    "Spain",
    "Sri Lanka",
    "Sudan",
    "Suriname",
    "Sweden",
    "Switzerland",
    "Syria",
    "Taiwan",
    "Tajikistan",
    "Tanzania",
    "Thailand",
    "Timor-Leste",
    "Togo",
    "Tonga",
    "Trinidad and Tobago",
    "Tunisia",
    "Turkey",
    "Turkmenistan",
    "Tuvalu",
    "Uganda",
    "Ukraine",
    "United Arab Emirates",
    "United Kingdom",
    "United States of America",
    "Uruguay",
    "Uzbekistan",
    "Vanuatu",
    "Vatican City",
    "Venezuela",
    "Vietnam",
    "Yemen",
    "Zambia",
    "Zimbabwe",
  ].sort((a, b) => a.localeCompare(b.name))
  // --- MODIFICATION END ---

  // Arrays of cities and states (keep unchanged)
  const indianCities = [
    "Mumbai",
    "Delhi",
    "Bangalore",
    "Hyderabad",
    "Ahmedabad",
    "Chennai",
    "Kolkata",
    "Surat",
    "Pune",
    "Jaipur",
    "Lucknow",
    "Kanpur",
    "Nagpur",
    "Indore",
    "Thane",
    "Bhopal",
    "Visakhapatnam",
    "Pimpri-Chinchwad",
    "Patna",
    "Vadodara",
    "Ghaziabad",
    "Ludhiana",
    "Agra",
    "Nashik",
    "Faridabad",
    "Meerut",
    "Rajkot",
    "Kalyan-Dombivli",
    "Vasai-Virar",
    "Varanasi",
    "Srinagar",
    "Aurangabad",
    "Dhanbad",
    "Amritsar",
    "Navi Mumbai",
    "Allahabad",
    "Ranchi",
    "Howrah",
    "Coimbatore",
    "Jabalpur",
    "Gwalior",
    "Vijayawada",
    "Jodhpur",
    "Madurai",
    "Raipur",
    "Kota",
    "Guwahati",
    "Chandigarh",
    "Solapur",
    "Hubli-Dharwad",
    "Bareilly",
    "Moradabad",
    "Mysore",
    "Gurgaon",
    "Aligarh",
    "Jalandhar",
    "Tiruchirappalli",
    "Bhubaneswar",
    "Salem",
    "Mira-Bhayandar",
    "Warangal",
    "Guntur",
    "Bhiwandi",
    "Saharanpur",
    "Gorakhpur",
    "Bikaner",
    "Amravati",
    "Noida",
    "Jamshedpur",
    "Bhilai Nagar",
    "Cuttack",
    "Firozabad",
    "Kochi",
    "Bhavnagar",
    "Dehradun",
    "Durgapur",
    "Asansol",
    "Nanded-Waghala",
    "Kolhapur",
    "Ajmer",
    "Gulbarga",
    "Jamnagar",
    "Ujjain",
    "Loni",
    "Siliguri",
    "Jhansi",
    "Ulhasnagar",
    "Nellore",
    "Jammu",
    "Sangli-Miraj & Kupwad",
    "Belgaum",
    "Mangalore",
    "Ambattur",
    "Tirunelveli",
    "Malegaon",
    "Gaya",
    "Jalgaon",
    "Udaipur",
    "Maheshtala",
  ]

  const indianStates = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Puducherry",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Lakshadweep",
    "Andaman and Nicobar Islands",
  ]

  // Helper functions for autocomplete (keep unchanged)
  const filterCities = (input) => {
    if (!input || input.length < 2) return []
    return indianCities.filter((city) => city.toLowerCase().includes(input.toLowerCase())).slice(0, 10)
  }

  const filterStates = (input) => {
    if (!input || input.length < 2) return []
    return indianStates.filter((state) => state.toLowerCase().includes(input.toLowerCase())).slice(0, 10)
  }

  const handleCityInputChange = (e) => {
    const value = e.target.value
    setFormData({ ...formData, city: value })

    if (value.length >= 2) {
      const suggestions = filterCities(value)
      setCitySuggestions(suggestions)
      setShowCitySuggestions(suggestions.length > 0)
    } else {
      setShowCitySuggestions(false)
    }
  }

  const handleStateInputChange = (e) => {
    const value = e.target.value
    setFormData({ ...formData, state: value })

    if (value.length >= 2) {
      const suggestions = filterStates(value)
      setStateSuggestions(suggestions)
      setShowStateSuggestions(suggestions.length > 0)
    } else {
      setShowStateSuggestions(false)
    }
  }

  const selectCity = (city) => {
    setFormData({ ...formData, city })
    setShowCitySuggestions(false)
  }

  const selectState = (state) => {
    setFormData({ ...formData, state })
    setShowStateSuggestions(false)
  }

  // Functions for dynamic fields
  const addCompanyNameField = () => {
    setAdditionalCompanyNames([...additionalCompanyNames, { id: Date.now(), name: "" }])
  }

  const removeCompanyNameField = (id) => {
    setAdditionalCompanyNames(additionalCompanyNames.filter((company) => company.id !== id))
  }

  const handleAdditionalCompanyNameChange = (id, value) => {
    setAdditionalCompanyNames(
      additionalCompanyNames.map((company) =>
        // Added .toUpperCase() here
        company.id === id ? { ...company, name: value.toUpperCase() } : company,
      ),
    )
  }

  // --- NEW: ADDITIONAL GST HANDLERS ---
  const addGstNumberField = () => {
    setAdditionalGstNumbers([...additionalGstNumbers, { id: Date.now(), number: "" }])
  }

  const removeGstNumberField = (id) => {
    setAdditionalGstNumbers(additionalGstNumbers.filter((item) => item.id !== id))
  }

  const handleAdditionalGstNumberChange = (id, value) => {
    // Apply the same uppercase and alphanumeric validation as the main GST field
    const validValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "")
    setAdditionalGstNumbers(
      additionalGstNumbers.map((item) =>
        item.id === id ? { ...item, number: validValue } : item
      )
    )
  }
  // ------------------------------------

  // --- NEW: ADDITIONAL ADDRESS HANDLERS ---
  const addAddress = () => {
    // UPDATED: Added locationArea to the initial object
    setAdditionalAddresses([...additionalAddresses, { id: Date.now(), address: "", locationArea: "", city: "", state: "", country: "", pinCode: "" }])
  }

  const removeAddress = (id) => {
    setAdditionalAddresses(additionalAddresses.filter(addr => addr.id !== id))
  }

  const updateAddress = (id, field, value) => {
    setAdditionalAddresses(
        additionalAddresses.map(addr => addr.id === id ? { ...addr, [field]: value } : addr)
    )
  }

  const handleAdditionalAddressLocationFetch = (id, locationData) => {
    setAdditionalAddresses(
        additionalAddresses.map(addr => addr.id === id ? {
            ...addr,
            city: addr.city || locationData.city, // Only update if empty? Or overwrite? Standard behavior implies overwrite or fill.
            state: locationData.state,
            country: locationData.country
        } : addr)
    )
  }
  // ----------------------------------------

  // --- NEW: ADDITIONAL UPDATE CALL HANDLERS ---
  const addUpdateCall = () => {
    setAdditionalUpdateCalls([...additionalUpdateCalls, { id: Date.now(), date: "", executive: "" }])
  }

  const removeUpdateCall = (id) => {
    setAdditionalUpdateCalls(additionalUpdateCalls.filter((call) => call.id !== id))
  }

  const updateUpdateCall = (id, field, value) => {
    setAdditionalUpdateCalls(
      additionalUpdateCalls.map((call) => (call.id === id ? { ...call, [field]: value } : call)),
    )
  }
  // --------------------------------------------

  const addContactPerson = () => {
    setAdditionalContactPersons([
      ...additionalContactPersons,
      { id: Date.now(), name: "", designation: "", phone: "", email: "", status: "Active" },
    ])
  }

  const removeContactPerson = (id) => {
    setAdditionalContactPersons(additionalContactPersons.filter((person) => person.id !== id))
  }

  const updateContactPerson = (id, field, value) => {
    setAdditionalContactPersons(
      additionalContactPersons.map((person) => (person.id === id ? { ...person, [field]: value } : person)),
    )
  }

  const addRevivalCall = () => {
    setAdditionalRevivalCalls([...additionalRevivalCalls, { id: Date.now(), date: "", executive: "", status: "" }])
  }

  const removeRevivalCall = (id) => {
    setAdditionalRevivalCalls(additionalRevivalCalls.filter((call) => call.id !== id))
  }

  const updateRevivalCall = (id, field, value) => {
    setAdditionalRevivalCalls(
      additionalRevivalCalls.map((call) => (call.id === id ? { ...call, [field]: value } : call)),
    )
  }

  // **NEW**: Functions for additional reallocations
  const addReallocation = () => {
    setAdditionalReallocations([
      ...additionalReallocations,
      { id: Date.now(), date: "", newFranchisee: "", newTeamLeader: "" },
    ])
  }

  const removeReallocation = (id) => {
    setAdditionalReallocations(additionalReallocations.filter((r) => r.id !== id))
  }

  const updateReallocation = (id, field, value) => {
    setAdditionalReallocations(additionalReallocations.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  // Restore original formData structure with all original fields
  const [formData, setFormData] = useState({
    companyName: "",
    // --- MODIFICATION START ---
    companyLogo: "",
    // --- MODIFICATION END ---
    dateClientAcquired: "",
    bdMembersName: "",
    address: "",
    city: "",
    pinCode: "",
    locationArea: "", // Added Location Area Field
    state: "",
    country: "",
    yearOfEstablishment: "", // Keep as string to avoid date conversion
    industry: "",
    subIndustry: "",
    tags: "", // New Field
    companyConstitution: "",
    numberOfEmployees: "",
    gstNumber: "",
    website: "",
    contactPersonName: "",
    contactDesignation: "",
    contactStatus: "Active", // New Field
    contactPhone: "",
    contactEmail: "",
    placementFees: "",
    additionalPlacementFees: "No",
    percentage: "",
    revisedPlacementFees: "",
    revisedPlacementFeesDate: "",
    creditPeriod: "",
    replacementPeriod: "",
    companyCategory: "",
    companyStatus: "",
    status: "",
    approvalStatus: "",
    remarks: "",
    dateOfRevivalCall: "",
    nameOfExecutive: "",
    statusOfCall: "",
    emeet: "No", // New Field
    revivalRemarks: "",
    updated: "No",
    dateOfDataUpdate: "",
    nameOfExecutiveUpdate: "",
    teamLeader: "",
    franchiseeName: "",
    dateOfClientAllocation: "",
    reallocationStatus: "No",
    dateOfClientReallocation: "",
    newFranchisee: "",
    newTeamLeader: "",
    prospectOptions: {
      noRequirement: false,
      notAgreeingToTerms: false,
      needToContactAgain: false,
      noVendorRequired: false, // New Field
    },
    contactDate: "",
    blacklistedBy: "",
    blacklistedReason: "",
    blacklistedApprovedBy: "",
  })

  const [formErrors, setFormErrors] = useState({})
  // --- MODIFICATION START ---
  // Initialize industry and sub-industry states with the static data.
  const [industries, setIndustries] = useState(STATIC_INDUSTRIES)
  const [subIndustries, setSubIndustries] = useState(STATIC_SUB_INDUSTRIES)
  // --- MODIFICATION END ---
  const [filteredSubIndustries, setFilteredSubIndustries] = useState([])
  // --- MODIFICATION START ---
  // The loadingIndustries state is no longer needed.
  // const [loadingIndustries, setLoadingIndustries] = useState(false);
  // --- MODIFICATION END ---
  const [marketingEmployees, setMarketingEmployees] = useState([])
  const [teamLeaderEmployees, setTeamLeaderEmployees] = useState([])
  const [filteredTeamLeaders, setFilteredTeamLeaders] = useState([])
  const [loadingEmployees, setLoadingEmployees] = useState(false)

  // Keep all existing useEffect hooks unchanged...
  useEffect(() => {
    if (initialData) {
      if (
        initialData.companyCategory &&
        !["MNC", "Start Up", "MSME", "SME", "GCC", "LARGE-CAP",  ""].includes(initialData.companyCategory)
      ) {
        setCustomCompanyCategories([initialData.companyCategory])
      }
    }
  }, [initialData])

  useEffect(() => {
    if (initialData) {
      console.log("Initial data for editing:", initialData)

      // --- MODIFICATION START ---
      // Convert industry/sub-industry names from initialData back to IDs for the form state
      const industryObject = industries.find((ind) => ind.name === initialData.industry)
      const industryId = industryObject ? String(industryObject.id) : initialData.industry

      const subIndustryObject = subIndustries.find((sub) => sub.name === initialData.subIndustry)
      const subIndustryId = subIndustryObject ? String(subIndustryObject.id) : initialData.subIndustry
      // --- MODIFICATION END ---

      const normalizeDecimalValue = (value) => {
        if (value === null || value === undefined) {
          return ""
        }
        const num = parseFloat(value)
        if (num % 1 === 0) {
          return String(num)
        }
        return String(value)
      }

      const updatedData = {
        companyName: initialData.companyName || "",
        // --- MODIFICATION START ---
        companyLogo: initialData.companyLogo || "",
        // --- MODIFICATION END ---
        dateClientAcquired: initialData.dateClientAcquired || "",
        bdMembersName: initialData.bdMembersName || "",
        address: initialData.address || "",
        city: initialData.city || "",
        pinCode: initialData.pinCode || "",
        locationArea: initialData.locationArea || "", // Mapped Location Area
        state: initialData.state || "",
        country: initialData.country || "",
        yearOfEstablishment: initialData.yearOfEstablishment ? String(initialData.yearOfEstablishment) : "", // Keep as string
        industry: industryId, // Use the found ID
        subIndustry: subIndustryId, // Use the found ID
        tags: initialData.tags || "",
        companyConstitution: initialData.companyConstitution || "",
        numberOfEmployees: initialData.numberOfEmployees || "",
        gstNumber: initialData.gstNumber || "",
        website: initialData.website || "",
        contactPersonName: initialData.contactPersonName || "",
        contactDesignation: initialData.contactDesignation || "",
        contactStatus: initialData.contactStatus || "Active",
        contactPhone: initialData.contactPhone || "",
        contactEmail: initialData.contactEmail || "",
        placementFees: normalizeDecimalValue(initialData.placementFees),
        additionalPlacementFees:
          initialData.additionalPlacementFees === "Yes" || initialData.additionalPlacementFees === true ? "Yes" : "No",
        percentage: normalizeDecimalValue(initialData.percentage),
        revisedPlacementFees: normalizeDecimalValue(initialData.revisedPlacementFees),
        revisedPlacementFeesDate: initialData.revisedPlacementFeesDate || "",
        creditPeriod: initialData.creditPeriod || "",
        replacementPeriod: initialData.replacementPeriod || "",
        companyCategory: initialData.companyCategory || "",
        companyStatus: initialData.companyStatus || "",
        status: initialData.status || "",
        approvalStatus: initialData.approvalStatus || "",
        remarks: initialData.remarks || "",
        dateOfRevivalCall: initialData.dateOfRevivalCall || "",
        nameOfExecutive: initialData.nameOfExecutive || "",
        statusOfCall: initialData.statusOfCall || "",
        emeet: initialData.emeet || "No",
        revivalRemarks: initialData.revivalRemarks || "",
        updated: initialData.updated === "Yes" || initialData.updated === true ? "Yes" : "No",
        dateOfDataUpdate: initialData.dateOfDataUpdate || "",
        nameOfExecutiveUpdate: initialData.nameOfExecutiveUpdate || "",
        teamLeader: initialData.teamLeader || "",
        franchiseeName: initialData.franchiseeName || "",
        dateOfClientAllocation: initialData.dateOfClientAllocation || "",
        reallocationStatus:
          initialData.reallocationStatus === "Yes" || initialData.reallocationStatus === true ? "Yes" : "No",
        dateOfClientReallocation: initialData.dateOfClientReallocation || "",
        newFranchisee: initialData.newFranchisee || "",
        newTeamLeader: initialData.newTeamLeader || "",
        prospectOptions: {
          noRequirement: initialData.prospectOptions?.noRequirement || false,
          notAgreeingToTerms: initialData.prospectOptions?.notAgreeingToTerms || false,
          needToContactAgain: initialData.prospectOptions?.needToContactAgain || false,
          noVendorRequired: initialData.prospectOptions?.noVendorRequired || false,
        },
        contactDate: initialData.contactDate || "",
        blacklistedBy: initialData.blacklistedBy || "",
        blacklistedReason: initialData.blacklistedReason || "",
        blacklistedApprovedBy: initialData.blacklistedApprovedBy || "",
      }

      setFormData(updatedData)

      // --- MODIFICATION START ---
      if (initialData.companyLogo) {
        setPreviewLogo(initialData.companyLogo)
      }
      // --- MODIFICATION END ---

      if (initialData.additionalCompanyNames) {
        setAdditionalCompanyNames(initialData.additionalCompanyNames)
      }
      // --- NEW: LOAD ADDITIONAL GST NUMBERS ---
      if (initialData.additionalGstNumbers) {
        setAdditionalGstNumbers(initialData.additionalGstNumbers)
      }
      // ----------------------------------------
      if (initialData.additionalContactPersons) {
        setAdditionalContactPersons(initialData.additionalContactPersons)
      }
      if (initialData.additionalRevivalCalls) {
        setAdditionalRevivalCalls(initialData.additionalRevivalCalls)
      }
      if (initialData.additionalReallocations) {
        setAdditionalReallocations(initialData.additionalReallocations)
      }
      // --- NEW: LOAD ADDITIONAL ADDRESSES ---
      if (initialData.additionalAddresses) {
        setAdditionalAddresses(initialData.additionalAddresses)
      }
      // --------------------------------------

      // --- NEW: LOAD ADDITIONAL UPDATE CALLS ---
      if (initialData.additionalUpdateCalls) {
        setAdditionalUpdateCalls(initialData.additionalUpdateCalls)
      }
      // -----------------------------------------

      setShowProspectOptions(initialData.status === "prospect")
      setShowContactDate(initialData.prospectOptions?.needToContactAgain || false)
      setShowBlacklistedFields(initialData.status === "blacklisted")
      // Update logic for reallocation fields visibility
      setShowReallocationFields(
          initialData.reallocationStatus === "Yes" || 
          initialData.reallocationStatus === true
          // Removed || initialData.status === "reallocation"
      )

      if (initialData.newTeamLeader) {
        fetchFranchiseesForReallocation(initialData.newTeamLeader)
      }

      // --- MODIFICATION START ---
      // Ensure the Franchisee Name dropdown is populated with the correct "Name / Owner" format
      // by fetching the specific list for the saved Team Leader.
      if (initialData.teamLeader) {
        fetchFranchiseesByTeamLeader(initialData.teamLeader)
      }
      // --- MODIFICATION END ---

    } else if (currentUser && currentUser.role === "franchisee" && currentUser.franchiseeName) {
      setFormData((prev) => ({
        ...prev,
        franchiseeName: currentUser.franchiseeName,
      }))
    }
  }, [initialData, currentUser, industries, subIndustries]) // Added industries/subIndustries to dependency array

  // This new effect auto-populates the team leader for a franchisee user when creating a new client.
  // Inside your ClientDataForm component...

  // This is the key useEffect we need to adjust.
  useEffect(() => {
    // --- MODIFICATION START: Added check for !isSpecifiedTeamLeader(currentUser) ---
    // This condition correctly targets a franchisee creating a NEW client after the main franchise list has loaded.
    // It prevents auto-population if the user is a SPECIFIED TEAM LEADER, even if their role is "franchisee".
    if (!initialData && currentUser?.role === "franchisee" && !isSpecifiedTeamLeader(currentUser) && currentUser.franchiseeName && franchises.length > 0) {
      const userFranchise = franchises.find((f) => f.nameAsPerAgreement === currentUser.franchiseeName)

      if (userFranchise && userFranchise.teamLeaderName) {
        const teamLeaderName = userFranchise.teamLeaderName

        // --- MODIFICATION START ---

        // 1. Set the form data VALUE for both franchisee and team leader
        setFormData((prev) => ({
          ...prev,
          teamLeader: teamLeaderName,
          franchiseeName: currentUser.franchiseeName,
        }))

        // 2. ALSO, set the OPTIONS for the team leader dropdown.
        // This ensures the dropdown has the correct name to display immediately.
        // We create a temporary object here to populate the <option>.
        setFilteredTeamLeaders([{ id: "franchisee-tl", name: teamLeaderName }])

        // --- MODIFICATION END ---

        // This part remains the same, to populate the franchisee dropdown options correctly.
        fetchFranchiseesByTeamLeader(teamLeaderName)
      }
    }
    // --- MODIFICATION END ---
  }, [currentUser, franchises, initialData]) // Dependencies are correct
// ── FRANCHISEE RECOMMENDATIONS — AbortController prevents cancelled requests ──
  useEffect(() => {
    if (!formData.teamLeader || !formData.industry || isViewMode || isFranchisee) {
      setFranchiseeRecommendations([])
      return
    }
    const industryObject = industries.find(ind => String(ind.id) === String(formData.industry))
    const industryName = industryObject ? industryObject.name : null
    if (!industryName) { setFranchiseeRecommendations([]); return }

    const controller = new AbortController()

    // 400ms debounce — prevents spamming on rapid state changes
    const timer = setTimeout(async () => {
      try {
        setLoadingRecommendations(true)
        const response = await fetch(
          `https://api.sarthi360.in/api/clientRecommendations/franchisee-recommendations?teamLeader=${encodeURIComponent(formData.teamLeader)}&industry=${encodeURIComponent(industryName)}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
        const data = await response.json()
        setFranchiseeRecommendations(data)
      } catch (err) {
        if (err.name !== "AbortError") {
          console.error("Error fetching franchisee recommendations:", err)
        }
        setFranchiseeRecommendations([])
      } finally {
        setLoadingRecommendations(false)
      }
    }, 400)

    // Cleanup cancels both the timer and any in-flight fetch
    return () => { clearTimeout(timer); controller.abort() }
  }, [formData.teamLeader, formData.industry, isViewMode, isFranchisee])
  // ─────────────────────────────────────────────────────────────────────────

  // --- MODIFICATION START ---
  // This function is no longer needed as the data is static.
  /*
  const fetchSubIndustriesForIndustry = async (industryId) => {
    try {
      setLoadingIndustries(true)
      const response = fetch(`https://api.sarthi360.in/api/industries/sub-industries`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const allSubIndustries = await response.json()
      const filtered = allSubIndustries.filter((sub) => sub.industry_id === Number(industryId))
      setSubIndustries(allSubIndustries)
      setFilteredSubIndustries(filtered)
      setLoadingIndustries(false)
    } catch (error) {
      console.error("Error fetching sub-industries for industry:", error)
      setLoadingIndustries(false)
    }
  }
  */
  // --- MODIFICATION END ---

useEffect(() => {
    if (preloadedEmployees.length > 0) {
      setEmployees(preloadedEmployees)
      const marketingEmps = preloadedEmployees.filter(
        (emp) => emp.department && emp.department.toLowerCase().trim() === "marketing team"
      )
      setMarketingEmployees(marketingEmps)
      const teamLeaderEmps = preloadedEmployees.filter(
        (emp) => emp.department && emp.department.toLowerCase().trim() === "team leader"
      )
      setTeamLeaderEmployees(teamLeaderEmps)
      setLoadingEmployees(false)
      return
    }

    const fetchEmployees = async () => {
      try {
        setLoadingEmployees(true)
        const response = await fetch("https://api.sarthi360.in/employees")
        if (!response.ok) {
          const errorText = await response.text()
          console.error("Fetch employees error:", response.status, errorText)
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const data = await response.json()
        console.log("Fetched employees:", data)
        setEmployees(data)
        const marketingEmps = data.filter(
          (emp) => emp.department && emp.department.toLowerCase().trim() === "marketing team"
        )
        setMarketingEmployees(marketingEmps)
        const teamLeaderEmps = data.filter(
          (emp) => emp.department && emp.department.toLowerCase().trim() === "team leader"
        )
        setTeamLeaderEmployees(teamLeaderEmps)
        setLoadingEmployees(false)
      } catch (error) {
        console.error("Error fetching employees:", error)
        setLoadingEmployees(false)
      }
    }
    fetchEmployees()
  }, [preloadedEmployees])

  useEffect(() => {
    if (currentUser && currentUser.designation && currentUser.designation.toLowerCase() === "team leader") {
      const self = teamLeaderEmployees.filter((emp) => emp.name === currentUser.name)
      setFilteredTeamLeaders(self)
      if (self.length > 0 && !formData.teamLeader) {
        setFormData((prev) => ({ ...prev, teamLeader: currentUser.name }))
        fetchFranchiseesByTeamLeader(currentUser.name)
      }
    } else {
      setFilteredTeamLeaders(teamLeaderEmployees)
    }
  }, [currentUser, teamLeaderEmployees, formData.teamLeader])

  useEffect(() => {
    const fetchFranchises = async () => {
      try {
        setLoadingFranchises(true)
        const response = await fetch("https://api.sarthi360.in/api/franchisees")

        if (!response.ok) {
          const errorText = await response.text()
          console.error("Fetch franchises error:", response.status, errorText)
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log("Fetched franchises:", data)

        // --- FIX: De-duplicate the franchisee list based on name to prevent rendering issues.
        const uniqueData = Array.from(new Map(data.map((f) => [f.nameAsPerAgreement, f])).values()).filter(
          (f) => f.nameAsPerAgreement,
        )

        const sortedData = [...uniqueData].sort((a, b) => a.nameAsPerAgreement.localeCompare(b.nameAsPerAgreement))

        // This list contains ALL franchises and is used by the new useEffect to find the team leader.
        setFranchises(sortedData)

        setLoadingFranchises(false)
      } catch (error) {
        console.error("Error fetching franchises:", error)
        setLoadingFranchises(false)
      }
    }

    fetchFranchises()
  }, []) // Removed currentUser dependency as we always fetch all franchises now

  // --- MODIFICATION START ---
  // The useEffect for fetching industries and sub-industries has been removed.
  // --- MODIFICATION END ---

  // --- MODIFICATION START ---
  useEffect(() => {
    // When the main industry is set (either from initialData or by user)
    // and the full list of sub-industries is available, filter the sub-industry dropdown options.
    if (formData.industry && subIndustries.length > 0) {
      const filtered = subIndustries.filter((sub) => sub.industry_id === Number(formData.industry))
      setFilteredSubIndustries(filtered)
    }
  }, [formData.industry, subIndustries]) // Re-run whenever the industry or the master list changes
  // --- MODIFICATION END ---

  // ====================================================================
  // ===== LOGIC MODIFIED: Only fetch State and Country from pincode ====
  // ====================================================================
useEffect(() => {
  if (formData.pinCode && formData.pinCode.length === 6) {
    const fetchPincodeData = async () => {
      try {
        const response = await fetch(
          `https://api.postalpincode.in/pincode/${formData.pinCode}`
        )
        const data = await response.json()

        if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice?.length > 0) {
          const postOffice = data[0].PostOffice[0]
          const state = postOffice.State || ""
          const country = postOffice.Country || "India"

          setFormData((prev) => ({
            ...prev,
            state: state,
            country: country,
          }))
        } else {
          // Fallback to Nominatim if postalpincode fails
          const fallback = await fetch(
            `https://nominatim.openstreetmap.org/search?postalcode=${formData.pinCode}&country=India&format=json&addressdetails=1`,
            { headers: { "Accept-Language": "en" } }
          )
          const fallbackData = await fallback.json()
          if (fallbackData && fallbackData.length > 0) {
            const address = fallbackData[0].address
            const state =
              address.state ||
              address.province ||
              address.region ||
              address["ISO3166-2-lvl4"] ||
              ""
            const country = address.country || "India"
            setFormData((prev) => ({
              ...prev,
              state: state,
              country: country,
            }))
          }
        }
      } catch (error) {
        console.error("Error fetching pincode data:", error)
      }
    }

    fetchPincodeData()
  }
}, [formData.pinCode])// This hook runs only when the pinCode value changes

  const handleChange = (e) => {
    const { name, value } = e.target

    if (name === "companyName") {
      // Changed: Force Uppercase for Company Name
      setFormData({ ...formData, [name]: value.toUpperCase() })
    } else if (name === "contactPersonName") {
      // Kept existing logic: Title Case for Contact Person
      const capitalizedValue = value
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")

      setFormData({ ...formData, [name]: capitalizedValue })
    } else if (name === "yearOfEstablishment") {
      // Handle year of establishment as plain text to avoid date conversion
      const yearValue = value.replace(/[^0-9]/g, "")
      if (yearValue.length <= 4) {
        setFormData({ ...formData, [name]: yearValue })
      }
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }
  const fetchFranchiseesByTeamLeader = async (teamLeaderName) => {
    if (!teamLeaderName) {
      setFranchises([])
      return
    }

    try {
      setLoadingFranchises(true)
      const response = await fetch(
        `https://api.sarthi360.in/franchisee?teamLeaderName=${encodeURIComponent(teamLeaderName)}`,
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data && Array.isArray(data)) {
        const filteredFranchisees = data.filter((franchise) => franchise.teamLeaderName === teamLeaderName)

        // --- FIX: De-duplicate the franchisee list based on name to prevent rendering issues.
        const uniqueFranchisees = Array.from(
          new Map(filteredFranchisees.map((f) => [f.nameAsPerAgreement, f])).values(),
        ).filter((f) => f.nameAsPerAgreement)

        const sortedFranchisees = [...uniqueFranchisees].sort((a, b) =>
          a.nameAsPerAgreement.localeCompare(b.nameAsPerAgreement),
        )
        setFranchises(sortedFranchisees)
      } else {
        console.error("Invalid response format for franchisees:", data)
        setFranchises([])
      }

      setLoadingFranchises(false)
    } catch (error) {
      console.error("Error fetching franchisees for team leader:", error)
      setLoadingFranchises(false)
      setFranchises([])
    }
  }

  // --- MODIFICATION START ---
  // New function to fetch franchisees for the reallocation section specifically
  const fetchFranchiseesForReallocation = async (teamLeaderName) => {
    if (!teamLeaderName) {
      setReallocationFranchises([])
      return
    }

    try {
      setLoadingReallocationFranchises(true)
      const response = await fetch(
        `https://api.sarthi360.in/franchisee?teamLeaderName=${encodeURIComponent(teamLeaderName)}`,
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()

      if (data && Array.isArray(data)) {
        const filteredFranchisees = data.filter((franchise) => franchise.teamLeaderName === teamLeaderName)
        // --- FIX: De-duplicate the franchisee list based on name.
        const uniqueFranchisees = Array.from(
          new Map(filteredFranchisees.map((f) => [f.nameAsPerAgreement, f])).values(),
        ).filter((f) => f.nameAsPerAgreement)

        const sortedFranchisees = [...uniqueFranchisees].sort((a, b) =>
          a.nameAsPerAgreement.localeCompare(b.nameAsPerAgreement),
        )
        setReallocationFranchises(sortedFranchisees)
      } else {
        console.error("Invalid response format for reallocation franchisees:", data)
        setReallocationFranchises([])
      }

      setLoadingReallocationFranchises(false)
    } catch (error) {
      console.error("Error fetching franchisees for reallocation:", error)
      setLoadingReallocationFranchises(false)
    }
  }
  // --- MODIFICATION END ---

  const handleSelectChange = (name, value, typedValue) => {
    // --- MODIFICATION: HANDLE ADD NEW FROM SEARCH ---
    
    // ------------------------------------------------

    if (name === "reallocationStatus") {
      setShowReallocationFields(value === "Yes")
      if (value === "No") {
        setFormData({
          ...formData,
          [name]: value,
          dateOfClientReallocation: "",
          newFranchisee: "",
          newTeamLeader: "",
        })
        setAdditionalReallocations([]) // Clear additional reallocations
      } else {
        setFormData({ ...formData, [name]: value })
      }
    } else if (name === "teamLeader") {
      // --- LOGIC CORRECTION START ---
      // When a Team Leader is changed, only clear the Franchisee Name if the current user is NOT a franchisee.
      // This preserves the pre-filled franchisee name for franchisee users.
      const newFranchiseeName = currentUser?.role === "franchisee" ? formData.franchiseeName : ""
      setFormData({ ...formData, [name]: value, franchiseeName: newFranchiseeName })
      // --- LOGIC CORRECTION END ---
      fetchFranchiseesByTeamLeader(value)
    }
    // --- MODIFICATION START ---
    // Corrected logic for selecting a new team leader in the reallocation section
    else if (name === "newTeamLeader") {
      setFormData({ ...formData, [name]: value, newFranchisee: "" }) // Reset new franchisee on new TL change
      fetchFranchiseesForReallocation(value) // Fetch franchisees for the NEW team leader
    }
    // --- MODIFICATION END ---
    else if (name === "status") {
      setFormData({ ...formData, [name]: value })
      setShowProspectOptions(value === "prospect")
      setShowBlacklistedFields(value === "blacklisted")

      // Logic for Revival and Reallocation opening sections
      // MODIFICATION: Removed the block that sets ShowReallocationFields(true) when value is "reallocation"
      
      if (value !== "prospect") {
        setShowContactDate(false)
        setFormData((prev) => ({
          ...prev,
          prospectOptions: {
            noRequirement: false,
            notAgreeingToTerms: false,
            needToContactAgain: false,
            noVendorRequired: false,
          },
        }))
      }

      if (value !== "blacklisted") {
        setFormData((prev) => ({
          ...prev,
          blacklistedBy: "",
          blacklistedReason: "",
          blacklistedApprovedBy: "",
        }))
      }
    } else {
      setFormData({ ...formData, [name]: value })
    }
  }

  const handlePhoneChange = (name, value) => {
    setFormData({ ...formData, [name]: value })
  }

  const handleDateChange = (name, value) => {
    setFormData({ ...formData, [name]: value })
  }

  const handlePincodeChange = (value) => {
    setFormData({ ...formData, pinCode: value })
  }

  const handleLocationFetch = (locationData) => {
    setFormData({
      ...formData,
      city: locationData.city,
      state: locationData.state,
      country: locationData.country,
    })
  }

  const handleIndustryChange = (industryId, typedValue) => {
    

    setFormData({ ...formData, industry: industryId, subIndustry: "" })
    if (industryId) {
      const filtered = subIndustries.filter((sub) => sub.industry_id === Number(industryId))
      setFilteredSubIndustries(filtered)
      // The fetchSubIndustriesForIndustry call is removed as it's no longer needed.
    } else {
      setFilteredSubIndustries([])
    }
  }

  const validateCapitalization = (value, fieldName) => {
    if (value && value.length > 0) {
      const firstChar = value.charAt(0)
      if (firstChar !== firstChar.toUpperCase()) {
        return `${fieldName} should start with a capital letter`
      }
    }
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (isSubmittingRef.current) return; // ADD THIS LINE
    
    const errors = {}

    const requiredFields = [
      "companyName",
      "bdMembersName",
      "address",
      "city",
      "pinCode",
      "locationArea", // Added to validation
      "state",
      "country",
      "yearOfEstablishment",
      "industry",
      "subIndustry",
      "companyConstitution",
      "numberOfEmployees",
      "gstNumber",
      "website",
      "contactPersonName",
      "contactDesignation",
      "contactPhone",
      "contactEmail",
      "placementFees",
      "additionalPlacementFees",
      "creditPeriod",
      "replacementPeriod",
      "companyCategory",
      "status",
      "teamLeader",
      "franchiseeName",
      "dateClientAcquired",
      "dateOfClientAllocation",
    ]

    requiredFields.forEach((field) => {
      if (!formData[field]) {
        errors[field] = `${field.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())} is required`
      }
    })

    const capitalizationError1 = validateCapitalization(formData.contactPersonName, "Contact Person Name")
    if (capitalizationError1) errors.contactPersonName = capitalizationError1

    const capitalizationError2 = validateCapitalization(formData.contactDesignation, "Designation")
    if (capitalizationError2) errors.contactDesignation = capitalizationError2

    const capitalizationError3 = validateCapitalization(formData.nameOfExecutive, "Name of Executive")
    if (capitalizationError3) errors.nameOfExecutive = capitalizationError3

    if (showReallocationFields) {
      if (!formData.dateOfClientReallocation) errors.dateOfClientReallocation = "Reallocation date is required"
      if (!formData.newFranchisee) errors.newFranchisee = "New franchisee is required"
      if (!formData.newTeamLeader) errors.newTeamLeader = "New team leader is required"
    }

    setFormErrors(errors)
    setShowValidationMessage(Object.keys(errors).length > 0)

   if (Object.keys(errors).length === 0) {
      // ── GST DUPLICATE GUARD ──────────────────────────────────────────
      const inputGst = (formData.gstNumber || "").trim().toUpperCase();
      if (inputGst) {
        const gstDuplicate = allClients.find((client) => {
          const isDifferentRecord = initialData ? client.id !== initialData.id : true;
          if (!isDifferentRecord) return false;

          // Check primary GST field
          const primaryMatch = (client.gstNumber || "").trim().toUpperCase() === inputGst;

          // Check additionalGstNumbers array
          let additionalMatch = false;
          if (Array.isArray(client.additionalGstNumbers)) {
            additionalMatch = client.additionalGstNumbers.some(
              (g) => (g.number || "").trim().toUpperCase() === inputGst
            );
          }

          return primaryMatch || additionalMatch;
        });

        if (gstDuplicate) {
          alert(`Duplicate GST Number: "${inputGst}" is already registered for "${gstDuplicate.companyName}". Cannot save.`);
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return; // BLOCKS the save entirely
        }
      }

      // ── ADDITIONAL GST NUMBERS DUPLICATE GUARD ───────────────────────
      for (const gstEntry of additionalGstNumbers) {
        const gstVal = (gstEntry.number || "").trim().toUpperCase();
        if (!gstVal) continue;

        const gstDuplicate = allClients.find((client) => {
          const isDifferentRecord = initialData ? client.id !== initialData.id : true;
          if (!isDifferentRecord) return false;

          const primaryMatch = (client.gstNumber || "").trim().toUpperCase() === gstVal;

          let additionalMatch = false;
          if (Array.isArray(client.additionalGstNumbers)) {
            additionalMatch = client.additionalGstNumbers.some(
              (g) => (g.number || "").trim().toUpperCase() === gstVal
            );
          }

          return primaryMatch || additionalMatch;
        });

        if (gstDuplicate) {
          alert(`Duplicate GST Number: "${gstVal}" is already registered for "${gstDuplicate.companyName}". Cannot save.`);
          setIsSubmitting(false);
          isSubmittingRef.current = false;
          return; // BLOCKS the save entirely
        }
      }
      // ── END GST DUPLICATE GUARD ──────────────────────────────────────

       isSubmittingRef.current = true;
      setIsSubmitting(true);
      // --- MODIFICATION START ---
      // Find the full industry and sub-industry objects to get their names for saving
      const selectedIndustry = industries.find((ind) => ind.id === Number(formData.industry))
      const selectedSubIndustry = subIndustries.find((sub) => sub.id === Number(formData.subIndustry))

      const preparedData = {
        ...formData,
        // Replace the industry and sub-industry IDs with their names before sending to the backend
        industry: selectedIndustry ? selectedIndustry.name : formData.industry,
        subIndustry: selectedSubIndustry ? selectedSubIndustry.name : formData.subIndustry,
        // --- MODIFICATION END ---
        status: formData.status || "active",
        prospectOptions: {
          noRequirement: formData.prospectOptions?.noRequirement || false,
          notAgreeingToTerms: formData.prospectOptions?.notAgreeingToTerms || false,
          needToContactAgain: formData.prospectOptions?.needToContactAgain || false,
          noVendorRequired: formData.prospectOptions?.noVendorRequired || false,
        },
         revivalRemarks: formData.revivalRemarks || null,
        additionalCompanyNames,
        // --- NEW: INCLUDE IN SUBMISSION ---
        additionalGstNumbers,
        additionalAddresses,
        additionalUpdateCalls,
        // ----------------------------------
        additionalContactPersons,
        additionalRevivalCalls,
        additionalReallocations,
        yearOfEstablishment: formData.yearOfEstablishment ? String(formData.yearOfEstablishment) : null, // Ensure it's a string
      }

      console.log("Submitting prepared data with names:", preparedData)
     try {
        // 3. WAIT FOR SAVE TO FINISH
        await onSave(preparedData)
      } catch (err) {
        // 4. UNLOCK ONLY IF DATABASE ERROR HAPPENS
        isSubmittingRef.current = false;
        setIsSubmitting(false);
        console.error("Save failed:", err);
      }
    } else {
      // UNLOCK IF VALIDATION FAILS (so user can fix errors and try again)
      isSubmittingRef.current = false;
      setShowValidationMessage(true);
      window.scrollTo(0, document.body.scrollHeight)
    }
  }

  const handleInputChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleStatusChange = (e) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
    setShowProspectOptions(value === "prospect")
    setShowBlacklistedFields(value === "blacklisted")
  }

  // --- MODIFICATION START ---
  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      try {
        const resizedImage = await resizeImage(file)
        setPreviewLogo(resizedImage)
        setFormData({
          ...formData,
          companyLogo: resizedImage,
        })
      } catch (error) {
        console.error("Error resizing logo:", error)
        alert("There was an error processing the image.")
      }
    }
  }
  // --- MODIFICATION END ---

  // --- MODIFICATION START ---
  // Handlers for the duplicate company modal
  const handleDuplicateConfirm = () => {
    if (duplicateClientData) {
      // Re-use logic from useEffect(initialData) to ensure correct formatting
      const industryObject = industries.find((ind) => ind.name === duplicateClientData.industry)
      const industryId = industryObject ? String(industryObject.id) : duplicateClientData.industry

      const subIndustryObject = subIndustries.find((sub) => sub.name === duplicateClientData.subIndustry)
      const subIndustryId = subIndustryObject ? String(subIndustryObject.id) : duplicateClientData.subIndustry

      const normalizeDecimalValue = (value) => {
        if (value === null || value === undefined) {
          return ""
        }
        const num = parseFloat(value)
        if (num % 1 === 0) {
          return String(num)
        }
        return String(value)
      }

      const updatedData = {
        companyName: duplicateClientData.companyName || "",
        companyLogo: duplicateClientData.companyLogo || "",
        dateClientAcquired: duplicateClientData.dateClientAcquired || "",
        bdMembersName: duplicateClientData.bdMembersName || "",
        address: duplicateClientData.address || "",
        city: duplicateClientData.city || "",
        pinCode: duplicateClientData.pinCode || "",
        locationArea: duplicateClientData.locationArea || "", // Mapped
        state: duplicateClientData.state || "",
        country: duplicateClientData.country || "",
        yearOfEstablishment: duplicateClientData.yearOfEstablishment
          ? String(duplicateClientData.yearOfEstablishment)
          : "",
        industry: industryId,
        subIndustry: subIndustryId,
        tags: duplicateClientData.tags || "",
        companyConstitution: duplicateClientData.companyConstitution || "",
        numberOfEmployees: duplicateClientData.numberOfEmployees || "",
        gstNumber: duplicateClientData.gstNumber || "",
        website: duplicateClientData.website || "",
        contactPersonName: duplicateClientData.contactPersonName || "",
        contactDesignation: duplicateClientData.contactDesignation || "",
        contactStatus: duplicateClientData.contactStatus || "Active",
        contactPhone: duplicateClientData.contactPhone || "",
        contactEmail: duplicateClientData.contactEmail || "",
        placementFees: normalizeDecimalValue(duplicateClientData.placementFees),
        additionalPlacementFees:
          duplicateClientData.additionalPlacementFees === "Yes" || duplicateClientData.additionalPlacementFees === true
            ? "Yes"
            : "No",
        percentage: normalizeDecimalValue(duplicateClientData.percentage),
        revisedPlacementFees: normalizeDecimalValue(duplicateClientData.revisedPlacementFees),
        revisedPlacementFeesDate: duplicateClientData.revisedPlacementFeesDate || "",
        creditPeriod: duplicateClientData.creditPeriod || "",
        replacementPeriod: duplicateClientData.replacementPeriod || "",
        companyCategory: duplicateClientData.companyCategory || "",
        companyStatus: duplicateClientData.companyStatus || "",
        status: duplicateClientData.status || "",
        approvalStatus: duplicateClientData.approvalStatus || "",
        remarks: duplicateClientData.remarks || "",
        dateOfRevivalCall: duplicateClientData.dateOfRevivalCall || "",
        nameOfExecutive: duplicateClientData.nameOfExecutive || "",
        statusOfCall: duplicateClientData.statusOfCall || "",
        emeet: duplicateClientData.emeet || "No",
        updated: duplicateClientData.updated === "Yes" || duplicateClientData.updated === true ? "Yes" : "No",
        dateOfDataUpdate: duplicateClientData.dateOfDataUpdate || "",
        nameOfExecutiveUpdate: duplicateClientData.nameOfExecutiveUpdate || "",
        teamLeader: duplicateClientData.teamLeader || "",
        franchiseeName: duplicateClientData.franchiseeName || "",
        dateOfClientAllocation: duplicateClientData.dateOfClientAllocation || "",
        reallocationStatus:
          duplicateClientData.reallocationStatus === "Yes" || duplicateClientData.reallocationStatus === true
            ? "Yes"
            : "No",
        dateOfClientReallocation: duplicateClientData.dateOfClientReallocation || "",
        newFranchisee: duplicateClientData.newFranchisee || "",
        newTeamLeader: duplicateClientData.newTeamLeader || "",
        prospectOptions: {
          noRequirement: duplicateClientData.prospectOptions?.noRequirement || false,
          notAgreeingToTerms: duplicateClientData.prospectOptions?.notAgreeingToTerms || false,
          needToContactAgain: duplicateClientData.prospectOptions?.needToContactAgain || false,
          noVendorRequired: duplicateClientData.prospectOptions?.noVendorRequired || false,
        },
        contactDate: duplicateClientData.contactDate || "",
        blacklistedBy: duplicateClientData.blacklistedBy || "",
        blacklistedReason: duplicateClientData.blacklistedReason || "",
        blacklistedApprovedBy: duplicateClientData.blacklistedApprovedBy || "",
      }

      setFormData(updatedData)

      if (duplicateClientData.companyLogo) {
        setPreviewLogo(duplicateClientData.companyLogo)
      }

      if (duplicateClientData.additionalCompanyNames) {
        setAdditionalCompanyNames(duplicateClientData.additionalCompanyNames)
      }
      // --- NEW: LOAD ADDITIONAL GST NUMBERS ---
      if (duplicateClientData.additionalGstNumbers) {
        setAdditionalGstNumbers(duplicateClientData.additionalGstNumbers)
      }
      // ----------------------------------------
      if (duplicateClientData.additionalContactPersons) {
        setAdditionalContactPersons(duplicateClientData.additionalContactPersons)
      }
      if (duplicateClientData.additionalRevivalCalls) {
        setAdditionalRevivalCalls(duplicateClientData.additionalRevivalCalls)
      }
      if (duplicateClientData.additionalReallocations) {
        setAdditionalReallocations(duplicateClientData.additionalReallocations)
      }
      if (duplicateClientData.additionalAddresses) {
        setAdditionalAddresses(duplicateClientData.additionalAddresses)
      }
      // --- NEW ---
      if (duplicateClientData.additionalUpdateCalls) {
          setAdditionalUpdateCalls(duplicateClientData.additionalUpdateCalls);
      }

      setShowProspectOptions(duplicateClientData.status === "prospect")
      setShowContactDate(duplicateClientData.prospectOptions?.needToContactAgain || false)
      setShowBlacklistedFields(duplicateClientData.status === "blacklisted")
      setShowReallocationFields(
        duplicateClientData.reallocationStatus === "Yes" || duplicateClientData.reallocationStatus === true
        // Removed || duplicateClientData.status === "reallocation"
      )

      if (duplicateClientData.newTeamLeader) {
        fetchFranchiseesForReallocation(duplicateClientData.newTeamLeader)
      }

      if (duplicateClientData.companyCategory && !["MNC", "Start Up", "MSME", "SME", "GCC", "LARGE-CAP", ""].includes(duplicateClientData.companyCategory)) {
        setCustomCompanyCategories([duplicateClientData.companyCategory]);
      }
    }
    setShowDuplicateModal(false)
  }

  const handleDuplicateCancel = () => {
    setShowDuplicateModal(false)
    setFormData((prev) => ({ ...prev, companyName: "" }))
    setDuplicateClientData(null)
  }

  // onBlur check for the company name input
 // onBlur check for the company name input
  const checkDuplicateCompany = (e) => {
    const inputName = e.target.value.trim().toLowerCase();
    
    if (!inputName) return;

    // We check allClients, but EXCLUDE the client we are currently editing by comparing IDs
    const duplicate = allClients.find((client) => {
      const isSameName = client.companyName.trim().toLowerCase() === inputName;
      const isDifferentRecord = initialData ? client.id !== initialData.id : true;
      
      return isSameName && isDifferentRecord;
    });

    if (duplicate) {
      setDuplicateClientData(duplicate);
      setShowDuplicateModal(true);
    }
  };
  // --- MODIFICATION END ---
// onBlur check for the GST number
  const checkDuplicateGst = (e) => {
    const inputGst = e.target.value.trim().toUpperCase();
    if (!inputGst) return;

    // Check allClients for matching GST, excluding current record if editing
    const duplicate = allClients.find((client) => {
      const isSameGst = (client.gstNumber || "").trim().toUpperCase() === inputGst;
      const isDifferentRecord = initialData ? client.id !== initialData.id : true;
      return isSameGst && isDifferentRecord;
    });

    if (duplicate) {
      alert(`Duplicate GST Number: This GST number is already registered for "${duplicate.companyName}". You cannot use a duplicate GST number.`);
      setFormData((prev) => ({ ...prev, gstNumber: "" })); // Clears the field to prevent entry
    }
  };
  return (
    <div className="min-h-screen bg-purple-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* --- MODIFICATION START --- */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <button onClick={onCancel} className="mr-3 text-gray-500 hover:text-gray-700">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="19" y1="12" x2="5" y2="12"></line>
                <polyline points="12 19 5 12 12 5"></polyline>
              </svg>
            </button>
            <h1 className="text-2xl font-bold text-purple-800">
              {isViewMode ? "View Client Details" : initialData ? "Edit Client Data" : "Add New Client"}
            </h1>
          </div>
          {isViewMode && (
            <button
              type="button"
              onClick={() => setIsViewMode(false)}
              className="bg-purple-700 hover:bg-purple-800 text-white px-4 py-2 rounded-md flex items-center justify-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-2"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit
            </button>
          )}
        </div>
        {/* --- MODIFICATION END --- */}

        <form onSubmit={handleSubmit}>
          {/* Basic Company Details */}
          <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-purple-900 mb-4">Basic Company Details</h2>

            {/* First Row with Logo */}
            {/* --- MODIFICATION START: Reduced bottom margin and aligned items --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 items-end">
              {/* --- MODIFICATION END --- */}
              {/* --- MODIFICATION START: ADDED LOGO UPLOAD --- */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Logo</label>
                <div className="mt-1 flex items-center">
                  <div className="w-24 h-24 border border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer relative overflow-hidden bg-white hover:border-purple-500">
                    {previewLogo ? (
                      <img
                        src={previewLogo}
                        alt="Company Logo Preview"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="text-xs text-gray-500 text-center p-2 flex flex-col items-center">
                        <Upload size={20} className="mb-1" />
                        <span>Add Logo</span>
                      </div>
                    )}
                    {!isViewMode && !isFranchisee && (
                      <input
                        type="file"
                        id="companyLogoUpload"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={isViewMode || isFranchisee}
                      />
                    )}
                  </div>
                </div>
              </div>
              {/* --- MODIFICATION END --- */}

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Name</label>
                <div className="flex items-center space-x-2">
                  <input
                    id="companyName"
                    name="companyName"
                    value={formData.companyName}
                    onChange={handleChange}
                    onBlur={checkDuplicateCompany}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        triggerGeminiFetch(formData.companyName)
                      }
                    }}
                    required
                    disabled={isViewMode || isFranchisee}
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  />
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addCompanyNameField}
                      className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add additional company name"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
                {formErrors.companyName && <p className="text-red-500 text-xs mt-1">{formErrors.companyName}</p>}
                <div className="space-y-2 mt-2">
                  {additionalCompanyNames.map((company, index) => (
                    <div key={company.id} className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder={`Additional Company Name ${index + 1}`}
                        value={company.name}
                        onChange={(e) => handleAdditionalCompanyNameChange(company.id, e.target.value)}
                        disabled={isViewMode}
                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                      />
                      {!isViewMode && (
                        <button
                          type="button"
                          onClick={() => removeCompanyNameField(company.id)}
                          className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-red-500 text-white rounded-md hover:bg-red-600"
                          title="Remove company name"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <DatePicker
                  label="Date Client Acquired"
                  name="dateClientAcquired"
                  value={formData.dateClientAcquired}
                  handleDateChange={(name, date) =>
                    handleDateChange(name, date ? format(date, "dd/MM/yyyy") : "")
                  }
                  required
                  disabled={isViewMode || isFranchisee}
                />
                {formErrors.dateClientAcquired && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.dateClientAcquired}</p>
                )}
              </div>

           <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">BD Members Name</label>
  <select
  id="bdMembersName"
  name="bdMembersName"
  value={formData.bdMembersName}
  onChange={(e) => handleSelectChange("bdMembersName", e.target.value)}
  required
  // DISABLED logic: 
  // 1. If in view mode
  // 2. If user is a normal Franchisee
  // 3. If User is Komal AND we are editing an existing record (initialData exists)
  disabled={
    isViewMode || 
    isFranchisee || 
    (initialData && normalizeName(currentUser?.name) === "komal bhanushali")
  } 
  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
>
  <option value="">{loadingEmployees ? "Loading employees..." : "Select"}</option>
  {marketingEmployees.map((employee) => (
    <option key={employee.id} value={employee.name}>
      {employee.name}
    </option>
  ))}
</select>
  {formErrors.bdMembersName && <p className="text-red-500 text-xs mt-1">{formErrors.bdMembersName}</p>}
</div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* --- MODIFICATION START: Updated Address Field Layout with Plus Button --- */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <div className="flex items-center space-x-2">
                    <input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      required
                      disabled={isViewMode || isFranchisee}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                    {!isViewMode && (
                        <button
                          type="button"
                          onClick={addAddress}
                          className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                          title="Add additional address"
                        >
                          <FiPlus size={16} />
                        </button>
                    )}
                </div>
                {formErrors.address && <p className="text-red-500 text-xs mt-1">{formErrors.address}</p>}
              </div>
              {/* --- MODIFICATION END --- */}

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                <input
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleCityInputChange}
                  onFocus={() => {
                    if (formData.city.length >= 2) {
                      const suggestions = filterCities(formData.city)
                      setCitySuggestions(suggestions)
                      setCitySuggestions(suggestions)
                      setShowCitySuggestions(suggestions.length > 0)
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowCitySuggestions(false), 200)
                  }}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  placeholder="Select or type to search"
                  list="city-list"
                />
                <datalist id="city-list">
                  {indianCities.map((city, index) => (
                    <option key={index} value={city} />
                  ))}
                </datalist>
                {showCitySuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {citySuggestions.map((city, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onMouseDown={() => selectCity(city)}
                      >
                        {city}
                      </div>
                    ))}
                  </div>
                )}
                {formErrors.city && <p className="text-red-500 text-xs mt-1">{formErrors.city}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pin Code</label>
                <PincodeInput
                  value={formData.pinCode}
                  onChange={(value) => setFormData((prev) => ({ ...prev, pinCode: value }))}
                  onLocationFetch={handleLocationFetch}
                  country={formData.country}
                  required
                  disabled={isViewMode || isFranchisee}
                />
                {formErrors.pinCode && <p className="text-red-500 text-xs mt-1">{formErrors.pinCode}</p>}
              </div>
            </div>

            {/* Third Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              {/* --- NEW MODIFICATION START: Added Location (Area) next to Pin Code Grid --- */}
              {/* --- NEW MODIFICATION: Location (Area) now editable by Franchisee --- */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Location (Area)</label>
  <input
    id="locationArea"
    name="locationArea"
    value={formData.locationArea}
    onChange={handleChange}
    required
    disabled={isViewMode} // Removed "|| isFranchisee" to allow access
    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
    placeholder="e.g., Andheri West"
  />
  {formErrors.locationArea && <p className="text-red-500 text-xs mt-1">{formErrors.locationArea}</p>}
</div>
              {/* --- NEW MODIFICATION END --- */}

              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                <input
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleStateInputChange}
                  onFocus={() => {
                    if (formData.state.length >= 2) {
                      const suggestions = filterStates(formData.state)
                      setStateSuggestions(suggestions)
                      setShowStateSuggestions(suggestions.length > 0)
                    }
                  }}
                  onBlur={() => {
                    setTimeout(() => setShowStateSuggestions(false), 200)
                  }}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  placeholder="Select or type to search"
                  list="state-list"
                />
                <datalist id="state-list">
                  {indianStates.map((state, index) => (
                    <option key={index} value={state} />
                  ))}
                </datalist>
                {showStateSuggestions && stateSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {stateSuggestions.map((state, index) => (
                      <div
                        key={index}
                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                        onMouseDown={() => selectState(state)}
                      >
                        {state}
                      </div>
                    ))}
                  </div>
                )}
                {formErrors.state && <p className="text-red-500 text-xs mt-1">{formErrors.state}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <select
                  id="country"
                  name="country"
                  value={formData.country || ""}
                  onChange={handleChange}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                  <option value="">Select Country</option>
                  {countries.map((country) => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                {formErrors.country && <p className="text-red-500 text-xs mt-1">{formErrors.country}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year Of Establishment</label>
                <input
                  id="yearOfEstablishment"
                  name="yearOfEstablishment"
                  type="text"
                  value={formData.yearOfEstablishment}
                  onChange={handleChange}
                  required
                  disabled={isViewMode || isFranchisee}
                  placeholder="e.g., 2020"
                  maxLength={4}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                />
                {formErrors.yearOfEstablishment && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.yearOfEstablishment}</p>
                )}
              </div>
            </div>

            {/* Additional Addresses List */}
            {additionalAddresses.map((addr, index) => (
                <div key={addr.id} className="border-t border-gray-200 pt-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <label className="block text-sm font-medium text-gray-700">Additional Address {index + 1}</label>
                        {!isViewMode && (
                            <button 
                                type="button" 
                                onClick={() => removeAddress(addr.id)} 
                                className="text-red-600 hover:text-red-800"
                            >
                                <FiTrash2 />
                            </button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        {/* UPDATED: Aligned Additional Address Layout to show Location Area */}
                        <div className="col-span-1 md:col-span-4">
                            <input
                                value={addr.address}
                                onChange={(e) => updateAddress(addr.id, 'address', e.target.value)}
                                placeholder="Address"
                                disabled={isViewMode}
                                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                            />
                        </div>
                         {/* --- NEW MODIFICATION: Added Location Area inside additional address --- */}
                         <div>
                            <input
                                value={addr.locationArea}
                                onChange={(e) => updateAddress(addr.id, 'locationArea', e.target.value)}
                                placeholder="Location (Area)"
                                disabled={isViewMode}
                                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                            />
                        </div>
                         <div className="relative">
                            <input
                                value={addr.city}
                                onChange={(e) => updateAddress(addr.id, 'city', e.target.value)}
                                placeholder="City"
                                disabled={isViewMode}
                                list={`city-list-${addr.id}`}
                                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                            />
                            <datalist id={`city-list-${addr.id}`}>
                                {indianCities.map((city, idx) => <option key={idx} value={city} />)}
                            </datalist>
                        </div>
                         <div>
                            <PincodeInput
                                value={addr.pinCode}
                                onChange={(value) => updateAddress(addr.id, 'pinCode', value)}
                                onLocationFetch={(data) => handleAdditionalAddressLocationFetch(addr.id, data)}
                                country={addr.country}
                                disabled={isViewMode}
                            />
                        </div>
                         <div className="relative">
                            <input
                                value={addr.state}
                                onChange={(e) => updateAddress(addr.id, 'state', e.target.value)}
                                placeholder="State"
                                disabled={isViewMode}
                                list={`state-list-${addr.id}`}
                                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                            />
                            <datalist id={`state-list-${addr.id}`}>
                                {indianStates.map((state, idx) => <option key={idx} value={state} />)}
                            </datalist>
                        </div>
                         <div>
                            <select
                                value={addr.country || ""}
                                onChange={(e) => updateAddress(addr.id, 'country', e.target.value)}
                                disabled={isViewMode}
                                className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                            >
                                <option value="">Select Country</option>
                                {countries.map((country) => (
                                    <option key={country} value={country}>{country}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            ))}

            {/* Fourth Row - Merged with Fifth Row Items */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
  <SearchableSelect
    name="industry"
    value={formData.industry}
    onChange={(value, typedValue) => handleIndustryChange(value, typedValue)}
    options={[
      ...industries.map((industry) => ({
        value: String(industry.id),
        label: industry.name,
      })),
       // Added dynamic add button
    ]}
    placeholder="Search or select industry..."
    disabled={isViewMode || isFranchisee}
    required
  />
  {formErrors.industry && <p className="text-red-500 text-xs mt-1">{formErrors.industry}</p>}
</div>

{/* Sub Industry Field */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">Sub Industry</label>
  <SearchableSelect
    name="subIndustry"
    value={formData.subIndustry}
   onChange={(value) => setFormData({ ...formData, subIndustry: value })}
    options={[
      ...filteredSubIndustries.map((sub) => ({
        value: String(sub.id),
        label: sub.name,
      })),
     
    ]}
    placeholder={!formData.industry ? "Select industry first" : "Search or select sub-industry..."}
    disabled={isViewMode || !formData.industry || isFranchisee}
    required
  />
  {formErrors.subIndustry && <p className="text-red-500 text-xs mt-1">{formErrors.subIndustry}</p>}
</div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                <input
                  type="text"
                  name="tags"
                  value={formData.tags}
                  onChange={handleChange}
                  placeholder="e.g., Tech, Startup, AI"
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Constitution</label>
                <select
                  id="companyConstitution"
                  name="companyConstitution"
                  value={formData.companyConstitution}
                  onChange={(e) => handleSelectChange("companyConstitution", e.target.value)}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                  <option value="">Select</option>
                  <option value="PARTNERSHIP">PARTNERSHIP</option>
                  <option value="LIMITED COMPANY (PUBLIC LISTED)">LIMITED COMPANY (PUBLIC LISTED)</option>
                  <option value="LIMITED COMPANY (UNLISTED)">LIMITED COMPANY (UNLISTED)</option>
                  <option value="PROPRIETORSHIP">PROPRIETORSHIP</option>
                  <option value="LIMITED LIABILITY PARTNERSHIP">LIMITED LIABILITY PARTNERSHIP (LLP)</option>
                  <option value="PRIVATE LIMITED COMPANY">PRIVATE LIMITED COMPANY</option>
                  <option value="CENTRAL GOVERNMENT- AUTONOMOUS INSTUTTION">
                    CENTRAL GOVERNMENT- AUTONOMOUS INSTUTTION
                  </option>
                  <option value="TRUST">TRUST</option>
                  <option value="COMPANY LIMITED BY GUARANTEE">COMPANY LIMITED BY GUARANTEE</option>
                  <option value="ONE PERSON COMPANY">ONE PERSON COMPANY (OPC)</option>
                  <option value="HINDU UNDIVIDED FAMILY">HINDU UNDIVIDED FAMILY (HUF)</option>
                  <option value="FUNDED STARTUPS">FUNDED STARTUPS</option>
                </select>
                {formErrors.companyConstitution && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.companyConstitution}</p>
                )}
              </div>

              {/* --- MODIFICATION START: Moved Number of Employees here --- */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Number Of Employees</label>
                <select
                  id="numberOfEmployees"
                  name="numberOfEmployees"
                  value={formData.numberOfEmployees}
                  onChange={handleChange}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                    <option value="">Select Range</option>
                    <option value="1-20">1-20</option>
                    <option value="20-50">20-50</option>
                    <option value="50-75">50-75</option>
                    <option value="75-100">75-100</option>
                    <option value="100-200">100-200</option>
                    <option value="200-500">200-500</option>
                    <option value="500+">500+</option>
                </select>
                {formErrors.numberOfEmployees && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.numberOfEmployees}</p>
                )}
              </div>
              {/* --- MODIFICATION END --- */}

              {/* --- MODIFICATION START: Moved GST Number here --- */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                {/* Main GST Input with Plus Button */}
               <div className="flex items-center space-x-2">
                  <input
                    id="gstNumber"
                    name="gstNumber"
                    value={formData.gstNumber || ""}
                    onChange={(e) => {
                      const value = e.target.value.toUpperCase()
                      const validValue = value.replace(/[^A-Z0-9]/g, "")
                      setFormData({ ...formData, gstNumber: validValue })
                    }}
                    // --- ADDED THIS LINE ---
                    onBlur={checkDuplicateGst} 
                    // -----------------------
                    maxLength={15}
                    required
                    disabled={isViewMode || isFranchisee}
                    placeholder="15-digit GST Number"
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  />
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addGstNumberField}
                      className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add additional GST Number"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
                
                {/* Validation Messages */}
                {formData.gstNumber && formData.gstNumber.length > 0 && formData.gstNumber.length !== 15 && (
                  <p className="text-red-500 text-xs mt-1">GST Number must be exactly 15 characters</p>
                )}
                {formErrors.gstNumber && <p className="text-red-500 text-xs mt-1">{formErrors.gstNumber}</p>}

                {/* Additional GST Fields List */}
                <div className="space-y-2 mt-2">
                  {additionalGstNumbers.map((gst, index) => (
                    <div key={gst.id} className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder={`Additional GST ${index + 1}`}
                        value={gst.number}
                        onChange={(e) => handleAdditionalGstNumberChange(gst.id, e.target.value)}
                        maxLength={15}
                        disabled={isViewMode}
                        className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                      />
                      {!isViewMode && (
                        <button
                          type="button"
                          onClick={() => removeGstNumberField(gst.id)}
                          className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-red-500 text-white rounded-md hover:bg-red-600"
                          title="Remove GST Number"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              {/* --- MODIFICATION END --- */}

              {/* --- MODIFICATION START: Moved Website here --- */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  id="website"
                  name="website"
                  type="text"
                  value={formData.website}
                  onChange={handleChange}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                />
                {formErrors.website && <p className="text-red-500 text-xs mt-1">{formErrors.website}</p>}
              </div>
              {/* --- MODIFICATION END --- */}

            </div>
          </div>


          {/* Contact Person in company */}
          <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-purple-900 mb-4">Contact Person in company</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Name</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    id="contactPersonName"
                    name="contactPersonName"
                    value={formData.contactPersonName}
                    onChange={handleInputChange}
                    required
                    disabled={isViewMode}
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  />
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addContactPerson}
                      className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add additional contact person"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
                {formErrors.contactPersonName && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.contactPersonName}</p>
                )}
                {formData.contactPersonName &&
                  formData.contactPersonName.length > 0 &&
                  formData.contactPersonName.charAt(0) !== formData.contactPersonName.charAt(0).toUpperCase() && (
                    <p className="text-orange-500 text-xs mt-1">
                      Contact Person Name should start with a capital letter.
                    </p>
                  )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                <input
                  type="text"
                  id="contactDesignation"
                  name="contactDesignation"
                  value={formData.contactDesignation}
                  onChange={handleInputChange}
                  required
                  disabled={isViewMode}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                />
                {formErrors.contactDesignation && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.contactDesignation}</p>
                )}
                {formData.contactDesignation &&
                  formData.contactDesignation.length > 0 &&
                  formData.contactDesignation.charAt(0) !== formData.contactDesignation.charAt(0).toUpperCase() && (
                    <p className="text-orange-500 text-xs mt-1">Designation should start with a capital letter.</p>
                  )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <PhoneInput
                      value={formData.contactPhone}
                      onChange={(value) => handlePhoneChange("contactPhone", value)}
                      required
                      disabled={isViewMode}
                    />
                  </div>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addContactPerson}
                      className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add additional contact person"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
                {formErrors.contactPhone && <p className="text-red-500 text-xs mt-1">{formErrors.contactPhone}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email ID</label>
                <div className="flex items-center space-x-2">
                  <input
                    id="contactEmail"
                    name="contactEmail"
                    type="email"
                    value={formData.contactEmail}
                    onChange={handleChange}
                    required
                    disabled={isViewMode}
                    className="flex-1 h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  />
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addContactPerson}
                      className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add additional contact person"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
                {formErrors.contactEmail && <p className="text-red-500 text-xs mt-1">{formErrors.contactEmail}</p>}
              </div>
            </div>
            
            {/* New Status field for Main Contact */}
            <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person Status</label>
                <select
                  name="contactStatus"
                  value={formData.contactStatus}
                  onChange={handleChange}
                  disabled={isViewMode}
                  className="w-full md:w-1/2 h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                </select>
            </div>

            {/* Additional Contact Persons */}
            {additionalContactPersons.map((person, index) => (
              <div key={person.id} className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Additional Contact Person {index + 1}</h4>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => removeContactPerson(person.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove contact person"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                    <input
                      value={person.name}
                      onChange={(e) => updateContactPerson(person.id, "name", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                    {person.name &&
                      person.name.length > 0 &&
                      person.name.charAt(0) !== person.name.charAt(0).toUpperCase() && (
                        <p className="text-orange-500 text-xs mt-1">Name should start with a capital letter.</p>
                      )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Designation</label>
                    <input
                      value={person.designation}
                      onChange={(e) => updateContactPerson(person.id, "designation", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                    {person.designation &&
                      person.designation.length > 0 &&
                      person.designation.charAt(0) !== person.designation.charAt(0).toUpperCase() && (
                        <p className="text-orange-500 text-xs mt-1">
                          Designation should start with a capital letter.
                        </p>
                      )}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <PhoneInput
                      value={person.phone}
                      onChange={(value) => updateContactPerson(person.id, "phone", value)}
                      disabled={isViewMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={person.email}
                      onChange={(e) => updateContactPerson(person.id, "email", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={person.status || "Active"}
                      onChange={(e) => updateContactPerson(person.id, "status", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    >
                        <option value="Active">Active</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Business Information */}
          <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-purple-900 mb-4">Business Information</h2>

            {/* First Row */}
            <div
              className={`grid grid-cols-1 gap-4 mb-4 ${
                formData.additionalPlacementFees === "Yes" ? "md:grid-cols-3" : "md:grid-cols-2"
              }`}
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Placement Fees</label>
                <select
                  id="placementFees"
                  name="placementFees"
                  value={formData.placementFees || ""}
                  onChange={(e) => handleSelectChange("placementFees", e.target.value)}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                  <option value="">Select</option>
                  <option value="6">6</option>
                  <option value="6.7">6.7</option>
                  <option value="7">7</option>
                  <option value="7.25">7.25</option>
                  <option value="7.33">7.33</option>
                  <option value="7.5">7.5</option>
                  <option value="7.75">7.75</option>
                  <option value="8">8</option>
                  <option value="8.33">8.33</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="10.5">10.5</option>
                  <option value="12.50">12.50</option>
                  <option value="13">13</option>
                  <option value="16">16</option>
                  <option value="18">18</option>
                </select>
                {formErrors.placementFees && <p className="text-red-500 text-xs mt-1">{formErrors.placementFees}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Placement Fees</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="additionalPlacementFees"
                      value="Yes"
                      checked={formData.additionalPlacementFees === "Yes"}
                      onChange={(e) => handleSelectChange("additionalPlacementFees", e.target.value)}
                      disabled={isViewMode || isFranchisee}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="additionalPlacementFees"
                      value="No"
                      checked={formData.additionalPlacementFees === "No"}
                      onChange={(e) => handleSelectChange("additionalPlacementFees", e.target.value)}
                      disabled={isViewMode || isFranchisee}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">No</span>
                  </label>
                </div>
              </div>

              {formData.additionalPlacementFees === "Yes" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Percentage %</label>
                  <select
                    id="percentage"
                    name="percentage"
                    value={formData.percentage || ""}
                    onChange={(e) => handleSelectChange("percentage", e.target.value)}
                    disabled={isViewMode || isFranchisee}
                    className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  >
                    <option value="">Select</option>
                    <option value="6">6</option>
                    <option value="7">7</option>
                    <option value="7.25">7.25</option>
                    <option value="7.5">7.5</option>
                    <option value="8">8</option>
                    <option value="8.33">8.33</option>
                    <option value="9">9</option>
                    <option value="10">10</option>
                    <option value="12.50">12.50</option>
                    <option value="13">13</option>
                    <option value="16">16</option>
                    <option value="18">18</option>
                  </select>
                </div>
              )}
            </div>
{/* Revised Placement Fees Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Revised Placement Fees</label>
                <select
                  id="revisedPlacementFees"
                  name="revisedPlacementFees"
                  value={formData.revisedPlacementFees || ""}
                  onChange={(e) => handleSelectChange("revisedPlacementFees", e.target.value)}
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                  <option value="">Select</option>
                  <option value="6">6</option>
                  <option value="6.7">6.7</option>
                  <option value="7">7</option>
                  <option value="7.25">7.25</option>
                  <option value="7.33">7.33</option>
                  <option value="7.5">7.5</option>
                  <option value="7.75">7.75</option>
                  <option value="8">8</option>
                  <option value="8.33">8.33</option>
                  <option value="9">9</option>
                  <option value="10">10</option>
                  <option value="10.5">10.5</option>
                  <option value="12.50">12.50</option>
                  <option value="13">13</option>
                  <option value="16">16</option>
                  <option value="18">18</option>
                </select>
              </div>

              <div>
                <DatePicker
                  label="Revised Placement Fees Date"
                  name="revisedPlacementFeesDate"
                  value={formData.revisedPlacementFeesDate}
                  handleDateChange={(name, date) =>
                    handleDateChange(name, date ? format(date, "dd/MM/yyyy") : "")
                  }
                  disabled={isViewMode || isFranchisee}
                />
              </div>
            </div>
            {/* Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Period</label>
                <select
                  id="creditPeriod"
                  name="creditPeriod"
                  value={formData.creditPeriod}
                  onChange={(e) => handleSelectChange("creditPeriod", e.target.value)}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                  <option value="">Select</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                  <option value="50">50</option>
                  <option value="60">60</option>
                  <option value="90">90</option>
                  <option value="30/60">30/60</option>
                  <option value="30/90">30/90</option>
                  
                </select>
                {formErrors.creditPeriod && <p className="text-red-500 text-xs mt-1">{formErrors.creditPeriod}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Replacement Period</label>
                <select
                  id="replacementPeriod"
                  name="replacementPeriod"
                  value={formData.replacementPeriod}
                  onChange={(e) => handleSelectChange("replacementPeriod", e.target.value)}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                  <option value="">Select</option>
                  <option value="30">30</option>
                  <option value="45">45</option>
                  <option value="60">60</option>
                  <option value="90">90</option>
                  <option value="120">120</option>
                  <option value="180">180</option>
                </select>
                {formErrors.replacementPeriod && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.replacementPeriod}</p>
                )}
              </div>
            </div>

            {/* Third Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Category</label>
                <select
                  id="companyCategory"
                  name="companyCategory"
                  value={formData.companyCategory || ""}
                  onChange={(e) => handleSelectChange("companyCategory", e.target.value)}
                  required
                  disabled={isViewMode || isFranchisee}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                  <option value="">Select</option>
                  <option value="MNC">MNC</option>
                  <option value="Start Up">Start Up</option>
                  <option value="MSME">MSME</option>
                  <option value="SME">SME</option>
                  <option value="GCC">GCC</option>
                  <option value="LARGE-CAP">LARGE-CAP</option>
                  {customCompanyCategories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                  
                </select>
                {formErrors.companyCategory && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.companyCategory}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Company Status</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || ""}
                  required
                  onChange={(e) => handleSelectChange("status", e.target.value)}
                  disabled={isViewMode}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                  <option value="">Select</option>
                  <option value="active">Active</option>
                  <option value="non-active">Non-Active</option>
                  <option value="prospect">Prospect</option>
                  <option value="blacklisted">Blacklisted</option>
                  <option value="revival">Revival</option>
                  <option value="reallocation">Reallocation</option>
                </select>
                {formErrors.status && <p className="text-red-500 text-xs mt-1">{formErrors.status}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Approval Status</label>
                <select
                  id="approvalStatus"
                  name="approvalStatus"
                  value={formData.approvalStatus || ""}
                  onChange={(e) => handleSelectChange("approvalStatus", e.target.value)}
                  disabled={isViewMode || !userPermissions.clientApprovalStatus}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-100 disabled:cursor-not-allowed"
                >
                  <option value="">Select</option>
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
                {formErrors.approvalStatus && <p className="text-red-500 text-xs mt-1">{formErrors.approvalStatus}</p>}
              </div>
            </div>

            {showProspectOptions && (
              <div className="col-span-3 mt-2 p-3 bg-gray-50 rounded-md">
                <p className="text-sm font-medium text-gray-700 mb-2">Prospect Options:</p>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.prospectOptions?.noRequirement || false}
                      onChange={(e) => {
                        const prospectOptions = { ...formData.prospectOptions, noRequirement: e.target.checked }
                        setFormData({ ...formData, prospectOptions })
                      }}
                      disabled={isViewMode}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Currently no requirement</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.prospectOptions?.notAgreeingToTerms || false}
                      onChange={(e) => {
                        const prospectOptions = { ...formData.prospectOptions, notAgreeingToTerms: e.target.checked }
                        setFormData({ ...formData, prospectOptions })
                      }}
                      disabled={isViewMode}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Not agreeing to terms</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.prospectOptions?.needToContactAgain || false}
                      onChange={(e) => {
                        const prospectOptions = {
                          ...formData.prospectOptions,
                          needToContactAgain: e.target.checked,
                        }
                        setFormData({ ...formData, prospectOptions })
                        setShowContactDate(e.target.checked)
                      }}
                      disabled={isViewMode}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Need to contact again</span>
                  </label>
                  {/* New Option */}
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.prospectOptions?.noVendorRequired || false}
                      onChange={(e) => {
                        const prospectOptions = { ...formData.prospectOptions, noVendorRequired: e.target.checked }
                        setFormData({ ...formData, prospectOptions })
                      }}
                      disabled={isViewMode}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">No Vendor Required</span>
                  </label>
                </div>
              </div>
            )}
            {showContactDate && (
              <div className="mt-2 ml-6">
                <DatePicker
                  label="Contact Date"
                  name="contactDate"
                  value={formData.contactDate}
                  handleDateChange={(name, date) =>
                    handleDateChange(name, date ? format(date, "dd/MM/yyyy") : "")
                  }
                  required={showContactDate}
                  disabled={isViewMode}
                />
              </div>
            )}
            {showBlacklistedFields && (
              <div className="col-span-3 mt-4 p-4 bg-gray-50 rounded-md">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Blacklisted Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name of person who blacklisted
                    </label>
                    <input
                      id="blacklistedBy"
                      name="blacklistedBy"
                      value={formData.blacklistedBy}
                      onChange={handleChange}
                      required={showBlacklistedFields}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <input
                      id="blacklistedReason"
                      name="blacklistedReason"
                      value={formData.blacklistedReason}
                      onChange={handleChange}
                      required={showBlacklistedFields}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Approved by</label>
                    <input
                      id="blacklistedApprovedBy"
                      name="blacklistedApprovedBy"
                      value={formData.blacklistedApprovedBy}
                      onChange={handleChange}
                      required={showBlacklistedFields}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Remarks */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
              <textarea
                id="remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={3}
                disabled={isViewMode}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
              />
            </div>

            {/* Fourth Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Of Revival Call</label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <DatePicker
                      label=""
                      name="dateOfRevivalCall"
                      value={formData.dateOfRevivalCall}
                      handleDateChange={(name, date) =>
                        handleDateChange(name, date ? format(date, "dd/MM/yyyy") : "")
                      }
                      disabled={isViewMode}
                    />
                  </div>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addRevivalCall}
                      className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add additional revival call"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name Of Executive</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    id="nameOfExecutive"
                    name="nameOfExecutive"
                    value={formData.nameOfExecutive}
                    onChange={handleInputChange}
                    disabled={isViewMode}
                    className="flex-1 h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  />
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addRevivalCall}
                      className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add additional revival call"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
                {formErrors.nameOfExecutive && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.nameOfExecutive}</p>
                )}
                {formData.nameOfExecutive &&
                  formData.nameOfExecutive.length > 0 &&
                  formData.nameOfExecutive.charAt(0) !== formData.nameOfExecutive.charAt(0).toUpperCase() && (
                    <p className="text-orange-500 text-xs mt-1">
                      Name of Executive should start with a capital letter.
                    </p>
                  )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status Of Call</label>
                <div className="flex items-center space-x-2">
                  <select
                    id="statusOfCall"
                    name="statusOfCall"
                    value={formData.statusOfCall}
                    onChange={(e) => handleSelectChange("statusOfCall", e.target.value)}
                    disabled={isViewMode}
                    className="flex-1 h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                  >
                    <option value="">Select</option>
                    <option value="Connected">Connected - Revived</option>
                    <option value="Ongoing Requirement">Ongoing Requirement</option>
                    <option value="Connected - No Requirement">Connected - No Requirement</option>
                    <option value="Connected- has own HR team">Connected- has own HR team</option>
                    <option value="Not Connected">Not Connected</option>
                    <option value="Busy">Busy</option>
                    <option value="No Vendor">No Vendor</option>
                    <option value="New SPOC Required">New SPOC Required</option>
                    <option value="Small Client">Small Client</option>
                  </select>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addRevivalCall}
                      className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add additional revival call"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
              </div>
              {formData.statusOfCall && (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">Revival Remarks</label>
    <textarea
      name="revivalRemarks"
      value={formData.revivalRemarks}
      onChange={handleChange}
      rows={3}
      disabled={isViewMode}
      placeholder="Enter revival remarks..."
      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
    />
  </div>
)}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-Meet</label>
                <select
                  name="emeet"
                  value={formData.emeet}
                  onChange={handleChange}
                  disabled={isViewMode}
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                >
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                </select>
              </div>
            </div>

            {/* Additional Revival Calls */}
            {additionalRevivalCalls.map((call, index) => (
              <div key={call.id} className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Additional Revival Call {index + 1}</h4>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => removeRevivalCall(call.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove revival call"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <DatePicker
                      label="Date"
                      name={`additionalRevivalDate_${call.id}`}
                      value={call.date}
                      handleDateChange={(name, date) =>
                        updateRevivalCall(call.id, "date", date ? format(date, "dd/MM/yyyy") : "")
                      }
                      disabled={isViewMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Executive</label>
                    <input
                      type="text"
                      value={call.executive}
                      onChange={(e) => updateRevivalCall(call.id, "executive", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                    {call.executive &&
                      call.executive.length > 0 &&
                      call.executive.charAt(0) !== call.executive.charAt(0).toUpperCase() && (
                        <p className="text-orange-500 text-xs mt-1">
                          Executive name should start with a capital letter.
                        </p>
                      )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={call.status}
                      onChange={(e) => updateRevivalCall(call.id, "status", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    >
                      <option value="">Select</option>
                    <option value="Connected">Connected - Revived</option>
                    <option value="Connected - No Requirement">Connected - No Requirement</option>
                    <option value="Connected- has own HR team">Connected- has own HR team</option>
                    <option value="Not Connected">Not Connected</option>
                    <option value="Busy">Busy</option>
                    <option value="No Vendor">No Vendor</option>
                    <option value="New SPOC Required">New SPOC Required</option>
                    <option value="Small Client">Small Client</option>
                  </select>
                  </div>
                </div>
              </div>
            ))}

            {/* Fifth Row - MODIFIED FOR DYNAMIC FIELDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 items-end">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Updated</label>
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="updated"
                      value="Yes"
                      checked={formData.updated === "Yes"}
                      onChange={(e) => handleSelectChange("updated", e.target.value)}
                      disabled={isViewMode}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Yes</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="updated"
                      value="No"
                      checked={formData.updated === "No"}
                      onChange={(e) => handleSelectChange("updated", e.target.value)}
                      disabled={isViewMode}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">No</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Of Data Update</label>
                <div className="flex items-center space-x-2">
                  <div className="flex-1">
                    <DatePicker
                      label=""
                      name="dateOfDataUpdate"
                      value={formData.dateOfDataUpdate}
                      handleDateChange={(name, date) =>
                        handleDateChange(name, date ? format(date, "dd/MM/yyyy") : "")
                      }
                      disabled={isViewMode}
                    />
                  </div>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={addUpdateCall}
                      className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add another update record"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data Updated By</label>
                <div className="flex items-center space-x-2">
                    <input
                      id="nameOfExecutiveUpdate"
                      name="nameOfExecutiveUpdate"
                      value={formData.nameOfExecutiveUpdate}
                      onChange={handleChange}
                      disabled={isViewMode}
                      className="flex-1 h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                    {!isViewMode && (
                    <button
                      type="button"
                      onClick={addUpdateCall}
                      className="h-10 w-10 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      title="Add another update record"
                    >
                      <FiPlus size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Additional Update Calls */}
            {additionalUpdateCalls.map((call, index) => (
              <div key={call.id} className="border-t pt-4 mt-4">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="text-sm font-medium text-gray-700">Additional Update Call {index + 1}</h4>
                  {!isViewMode && (
                    <button
                      type="button"
                      onClick={() => removeUpdateCall(call.id)}
                      className="text-red-600 hover:text-red-800"
                      title="Remove update call"
                    >
                      <FiTrash2 size={16} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <DatePicker
                      label="Date Of Data Update"
                      name={`additionalUpdateDate_${call.id}`}
                      value={call.date}
                      handleDateChange={(name, date) =>
                        updateUpdateCall(call.id, "date", date ? format(date, "dd/MM/yyyy") : "")
                      }
                      disabled={isViewMode}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Data Updated By</label>
                    <input
                      type="text"
                      value={call.executive}
                      onChange={(e) => updateUpdateCall(call.id, "executive", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Franchise & Team Details */}
          <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
            <h2 className="text-lg font-semibold text-purple-900 mb-4">Franchise & Team Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team Leader</label>
                <select
                  id="teamLeader"
                  name="teamLeader"
                  value={formData.teamLeader}
                  onChange={(e) => handleSelectChange("teamLeader", e.target.value)}
                  required
                  disabled={
                    isViewMode ||
                    isFranchisee
                  }
                  className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-100 disabled:cursor-not-allowed"
                >
                  <option value="">{loadingEmployees ? "Loading..." : "Select"}</option>
                  {filteredTeamLeaders.map((employee) => (
                    <option key={employee.id} value={employee.name}>
                      {employee.name}
                    </option>
                  ))}
                </select>
                {formErrors.teamLeader && <p className="text-red-500 text-xs mt-1">{formErrors.teamLeader}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Franchisee Name</label>
                {!useCustomFranchisee ? (
                  <div className="flex space-x-2">
                    {/* --- MODIFICATION START --- */}
                    <SearchableSelect
                      name="franchiseeName"
                      value={formData.franchiseeName}
                      onChange={(value) => {
                        if (value === "custom") {
                          setUseCustomFranchisee(true)
                          setFormData({ ...formData, franchiseeName: "" })
                        } else {
                          handleSelectChange("franchiseeName", value)
                        }
                      }}
                      options={[
                        { value: "Unknown", label: "Unknown" },
                        ...franchises.map((f) => ({
                          value: f.nameAsPerAgreement,
                          label: f.nameOfFranchiseeOwner
                            ? `${f.nameAsPerAgreement} / ${f.nameOfFranchiseeOwner}`
                            : f.nameAsPerAgreement,
                        })),
                        
                      ]}
                      placeholder={
                        loadingFranchises
                          ? "Loading..."
                          : formData.teamLeader
                            ? "Select or type to search..."
                            : "Select Team Leader first"
                      }
                      disabled={isViewMode || !formData.teamLeader || isFranchisee}
                      required
                    />
                    {/* --- MODIFICATION END --- */}
                  </div>
                ) : (
                  <div className="flex space-x-2">
                    <input
                      id="franchiseeName"
                      name="franchiseeName"
                      value={formData.franchiseeName}
                      onChange={handleChange}
                      required
                      disabled={isViewMode || isFranchisee}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                      placeholder="Enter franchisee name"
                    />
                    {!isViewMode && (
                      <button
                        type="button"
                        onClick={() => setUseCustomFranchisee(false)}
                        className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        Back to List
                      </button>
                    )}
                  </div>
                )}
                {formErrors.franchiseeName && <p className="text-red-500 text-xs mt-1">{formErrors.franchiseeName}</p>}
                
                
                
                {/* ── FRANCHISEE RECOMMENDATIONS ── */}
                {!isViewMode && !isFranchisee && (franchiseeRecommendations.length > 0 || loadingRecommendations) && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-500" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      Recommended based on industry match:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {loadingRecommendations ? (
                        <span className="text-xs text-gray-400">Loading recommendations...</span>
                      ) : (
                        franchiseeRecommendations.map((rec, index) => (
                          <button
                            key={index}
                            type="button"
                            onClick={() => { handleSelectChange("franchiseeName", rec.franchiseeName); setUseCustomFranchisee(false) }}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                              formData.franchiseeName === rec.franchiseeName
                                ? "bg-purple-700 text-white border-purple-700"
                                : "bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                            }`}
                            title={`${rec.industryCount} closed deals in this industry`}
                          >
                            {rec.franchiseeName}
                            <span className="ml-1 opacity-60">({rec.industryCount})</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <DatePicker
                  label="Date Of Client Allocation"
                  name="dateOfClientAllocation"
                  value={formData.dateOfClientAllocation}
                  handleDateChange={(name, date) =>
                    handleDateChange(name, date ? format(date, "dd/MM/yyyy") : "")
                  }
                  required
                  disabled={isViewMode || isFranchisee}
                />
                {formErrors.dateOfClientAllocation && (
                  <p className="text-red-500 text-xs mt-1">{formErrors.dateOfClientAllocation}</p>
                )}
              </div>
            </div>

            {/* --- MODIFICATION START --- */}
            {/* The logic below HIDES the reallocation section if the user is a Franchisee, per requirement */}
            {!isFranchisee && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reallocation Status</label>
                  <div className="flex items-center gap-2">
                    <select
                      id="reallocationStatus"
                      name="reallocationStatus"
                      value={formData.reallocationStatus}
                      onChange={(e) => handleSelectChange("reallocationStatus", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    >
                      <option value="No">No</option>
                      <option value="Yes">Yes</option>
                    </select>
                    {showReallocationFields && !isViewMode && currentUser?.role !== "franchisee" && (
                      <button
                        type="button"
                        onClick={addReallocation}
                        className="h-10 w-10 flex-shrink-0 flex items-center justify-center bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        title="Add another reallocation"
                      >
                        <FiPlus size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isFranchisee && showReallocationFields && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <DatePicker
                      label="Date Of Client Reallocation"
                      name="dateOfClientReallocation"
                      value={formData.dateOfClientReallocation}
                      handleDateChange={(name, date) =>
                        handleDateChange(name, date ? format(date, "dd/MM/yyyy") : "")
                      }
                      disabled={isViewMode}
                    />
                    {formErrors.dateOfClientReallocation && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.dateOfClientReallocation}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Team Leader</label>
                    <select
                      id="newTeamLeader"
                      name="newTeamLeader"
                      value={formData.newTeamLeader}
                      onChange={(e) => handleSelectChange("newTeamLeader", e.target.value)}
                      disabled={isViewMode}
                      className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
                    >
                      <option value="">Select</option>
                      {teamLeaderEmployees.map((employee) => (
                        <option key={employee.id} value={employee.name}>
                          {employee.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.newTeamLeader && (
                      <p className="text-red-500 text-xs mt-1">{formErrors.newTeamLeader}</p>
                    )}
                  </div>

                  {/* --- MODIFICATION START --- */}
                  {/* --- PRIMARY NEW FRANCHISEE FIELD --- */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">New Franchisee</label>
  <SearchableSelect
    name="newFranchisee"
    value={formData.newFranchisee}
    onChange={(value) => handleSelectChange("newFranchisee", value)}
    // FIX: Include the current value in the options so it isn't blank on load
    options={[
      ...(formData.newFranchisee ? [{ value: formData.newFranchisee, label: formData.newFranchisee }] : []),
      { value: "Unknown", label: "Unknown" },
      ...reallocationFranchises
        .filter(f => f.nameAsPerAgreement !== formData.newFranchisee)
        .map((f) => ({
          value: f.nameAsPerAgreement,
          label: f.nameOfFranchiseeOwner
            ? `${f.nameAsPerAgreement} / ${f.nameOfFranchiseeOwner}`
            : f.nameAsPerAgreement,
        })),
    ]}
    placeholder={
      loadingReallocationFranchises
        ? "Loading..."
        : formData.newTeamLeader
          ? "Select or type..."
          : "Select New Team Leader first"
    }
    disabled={isViewMode || !formData.newTeamLeader}
    // Ensure list is fetched if user clicks into it
    onFocus={() => {
      if (formData.newTeamLeader) {
        fetchFranchiseesForReallocation(formData.newTeamLeader);
      }
    }}
  />
  {formErrors.newFranchisee && (
    <p className="text-red-500 text-xs mt-1">{formErrors.newFranchisee}</p>
  )}
</div>
                  {/* --- MODIFICATION END --- */}
                </div>

               {/* Additional Reallocations - FIXED VERSION */}
{/* Additional Reallocations Section */}
{/* Additional Reallocations Section */}
{additionalReallocations.map((reallocation, index) => {
  // --- FIX: Create a temporary option for the currently saved franchisee ---
  // This ensures the field is NOT blank even if the global list hasn't loaded yet.
  const currentOption = reallocation.newFranchisee 
    ? [{ value: reallocation.newFranchisee, label: reallocation.newFranchisee }] 
    : [];

  return (
    <div key={reallocation.id} className="border-t pt-4 mt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="text-sm font-medium text-gray-700">Additional Reallocation {index + 1}</h4>
        {!isViewMode && currentUser?.role !== "franchisee" && (
          <button
            type="button"
            onClick={() => removeReallocation(reallocation.id)}
            className="text-red-600 hover:text-red-800 p-1"
            title="Remove Reallocation"
          >
            <FiTrash2 size={16} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <DatePicker
            label="Date"
            name={`additionalReallocationDate_${reallocation.id}`}
            value={reallocation.date}
            handleDateChange={(name, date) =>
              updateReallocation(reallocation.id, "date", date ? format(date, "dd/MM/yyyy") : "")
            }
            disabled={isViewMode}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Team Leader</label>
          <select
            value={reallocation.newTeamLeader || ""}
            onChange={(e) => {
              const val = e.target.value;
              updateReallocation(reallocation.id, "newTeamLeader", val);
              // Trigger fetch for this specific TL
              fetchFranchiseesForReallocation(val);
            }}
            disabled={isViewMode}
            className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-50"
          >
            <option value="">Select</option>
            {teamLeaderEmployees.map((employee) => (
              <option key={employee.id} value={employee.name}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">New Franchisee</label>
          <SearchableSelect
            value={reallocation.newFranchisee || ""}
            onChange={(value) => updateReallocation(reallocation.id, "newFranchisee", value)}
            options={[
              ...currentOption, // Always include the saved value first
              { value: "Unknown", label: "Unknown" },
              ...reallocationFranchises
                .filter(f => f.nameAsPerAgreement !== reallocation.newFranchisee) // Avoid duplicates
                .map((f) => ({
                  value: f.nameAsPerAgreement,
                  label: f.nameOfFranchiseeOwner
                    ? `${f.nameAsPerAgreement} / ${f.nameOfFranchiseeOwner}`
                    : f.nameAsPerAgreement,
                })),
            ]}
            placeholder={
              loadingReallocationFranchises
                ? "Loading..."
                : reallocation.newTeamLeader
                ? "Search or type..."
                : "Select Team Leader first"
            }
            disabled={isViewMode || !reallocation.newTeamLeader}
            // Trigger fetch when user clicks the input
            onFocus={() => {
              if (reallocation.newTeamLeader) {
                fetchFranchiseesForReallocation(reallocation.newTeamLeader);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
})}
              </>
            )}
            {/* --- MODIFICATION END (for Reallocation Visibility) --- */}

            {/* --- MODIFICATION START --- */}
            {/* Conditional Buttons at the bottom of the form */}
            <div className="flex justify-center gap-4 mt-8">
              {isViewMode ? (
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-8 py-2 bg-gray-300 text-gray-800 rounded-md font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                >
                  Close
                </button>
              ) : (
                <>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-8 py-2 bg-purple-700 text-white rounded-md font-medium hover:bg-purple-800 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                  >
                     {isSubmitting ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={onCancel}
                    className="px-8 py-2 bg-gray-300 text-gray-800 rounded-md font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            {/* --- MODIFICATION END --- */}
          </div>

          {showValidationMessage && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mt-6">
              <p className="font-medium">All fields are compulsory. Please complete all fields in the form.</p>
              <ul className="mt-2 list-disc list-inside text-sm">
                {Object.values(formErrors).map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </form>

        {/* --- MODIFICATION START --- */}
        {/* Modal for duplicate company name confirmation */}
           {showDuplicateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl border border-gray-300">
              <h3 className="text-lg font-semibold mb-4 text-red-600">Duplicate Company Name</h3>
              <p className="mb-6">This company name already exists in the system. You cannot add a duplicate entry.</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleDuplicateCancel}
                  className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 font-medium"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
        {/* --- MODIFICATION END --- */}
        
        {/* ── GEMINI MODALS ─────────────────────────────────────────────── */}
        {isGeminiFetching && (
          <div className="fixed bottom-6 right-6 z-[9999] bg-white border border-purple-200 rounded-xl shadow-2xl px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-indigo-500 flex items-center justify-center flex-shrink-0">
              <svg className="animate-spin w-5 h-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-purple-900">Fetching company details…</p>
              <p className="text-xs text-gray-400">Powered by Gemini AI</p>
            </div>
          </div>
        )}

        {geminiError && (
          <div className="fixed bottom-6 right-6 z-[9999] bg-red-50 border border-red-200 rounded-xl shadow-2xl px-5 py-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <p className="text-sm font-medium text-red-700">{geminiError}</p>
          </div>
        )}

        {showGeminiModal && geminiSuggestion && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9998] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-purple-100 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-700 to-indigo-600 px-6 py-4 flex items-center gap-3">
  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 overflow-hidden border-2 border-white/30">
  <img
    src={geminiSuggestion?.logoUrl || ""}
    alt="logo"
    className="w-8 h-8 object-contain"
    onError={(e) => {
      e.target.style.display = "none"
      e.target.parentElement.innerHTML = `<svg class="w-5 h-5" fill="none" stroke="#7c3aed" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>`
    }}
  />
</div>
                <div>
                  <h3 className="text-white font-bold text-base leading-tight">AI Found Company Details</h3>
                  <p className="text-purple-200 text-xs mt-0.5">Review and apply to auto-fill the form</p>
                </div>
              </div>
              <div className="p-5 max-h-72 overflow-y-auto">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Company",      value: geminiSuggestion.companyName },
                    { label: "Website",      value: geminiSuggestion.website },
                    { label: "Address",      value: geminiSuggestion.address,            full: true },
                    { label: "Area",         value: geminiSuggestion.locationArea },
                    { label: "City",         value: geminiSuggestion.city },
                    { label: "State",        value: geminiSuggestion.state },
                    { label: "Country",      value: geminiSuggestion.country },
                    { label: "Pin Code",     value: geminiSuggestion.pinCode },
                    { label: "Contact",      value: geminiSuggestion.contactPersonName },
                    { label: "Designation",  value: geminiSuggestion.contactDesignation },
                    { label: "Phone",        value: geminiSuggestion.contactPhone },
                    { label: "Email",        value: geminiSuggestion.contactEmail,        full: true },
                    { label: "Industry",     value: geminiSuggestion.industry },
                    { label: "Employees",    value: geminiSuggestion.numberOfEmployees },
                    { label: "Constitution", value: geminiSuggestion.companyConstitution, full: true },
                    { label: "Est. Year",    value: geminiSuggestion.yearOfEstablishment },
                  ]
                    .filter((item) => item.value && String(item.value).trim() !== "")
                    .map((item, idx) => (
                      <div key={idx} className={`${item.full ? "col-span-2" : "col-span-1"} bg-purple-50 rounded-lg px-3 py-2`}>
                        <p className="text-xs text-purple-500 font-semibold uppercase tracking-wide leading-none mb-0.5">{item.label}</p>
                        <p className="text-sm text-gray-800 font-medium truncate" title={String(item.value)}>{String(item.value)}</p>
                      </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 mt-3 text-center italic">
                  ⚠️ AI-generated — please verify before saving. Only empty fields will be filled.
                </p>
              </div>
              <div className="px-5 pb-5 flex gap-3">
                <button type="button" onClick={applyGeminiSuggestion}
                  className="flex-1 bg-purple-700 hover:bg-purple-800 text-white py-2.5 rounded-lg font-semibold text-sm transition-colors shadow-sm">
                  ✓ Apply Suggestions
                </button>
                <button type="button" onClick={() => { setShowGeminiModal(false); setGeminiSuggestion(null) }}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-semibold text-sm transition-colors">
                  Skip
                </button>
              </div>
            </div>
          </div>
        )}
        {/* ── END GEMINI MODALS ──────────────────────────────────────────── */}
      </div>
    </div>
  )
}
