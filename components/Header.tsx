import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IconSearch, IconX, IconPlus } from '../constants';
import { LoggedInUser, Customer, Lead, ItineraryMetadata, Staff, Branch } from '../types';
import { useAuth } from '../contexts/AuthProvider';
import { useData } from '../contexts/DataProvider';
import { useRouter } from '../contexts/RouterProvider';
import { useToast } from './ToastProvider';
import { UserStatus } from './UserStatus';
import { Input } from './ui/input';
import { supabase } from '../lib/supabase';
import { NotificationsDrawer, NotificationsBell } from './NotificationsDrawer';

type SearchResult =
  | (Customer & { search_type: 'customer' })
  | (Lead & { search_type: 'lead' })
  | (ItineraryMetadata & { search_type: 'itinerary' })
  | (Staff & { search_type: 'staff' })
  | (Branch & { search_type: 'branch' });

// Helper function to generate MTS ID from lead
const generateMTSId = (lead: Lead): string => {
    if (!lead || !lead.id || !lead.created_at) {
        return 'N/A';
    }
    const createdAt = new Date(lead.created_at);
    const day = String(createdAt.getDate()).padStart(2, '0');
    const month = String(createdAt.getMonth() + 1).padStart(2, '0');
    const year = String(createdAt.getFullYear()).slice(-2);
    return `MTS-${lead.id}${day}${month}${year}`;
};

const GlobalSearch: React.FC<{ profile: LoggedInUser }> = ({ profile }) => {
    const [query, setQuery] = useState('');
    const [isActive, setIsActive] = useState(false);
    const { customers, leads, itineraries, staff, branches } = useData();
    const { navigate } = useRouter();
    const searchRef = useRef<HTMLDivElement>(null);
    const { addToast } = useToast();

    const results = useMemo<SearchResult[]>(() => {
        if (query.length < 2) return [];

        const lowerQuery = query.toLowerCase();
        
        const customerResults = customers
            .filter(c => {
                const searchText = `${c.first_name || ''} ${c.last_name || ''} ${c.email || ''} ${c.phone || ''}`.toLowerCase();
                return searchText.includes(lowerQuery);
            })
            .map(c => ({ ...c, search_type: 'customer' as const }));

        const leadResults = leads
            .filter(l => {
                if (!l) return false;
                const mtsId = generateMTSId(l);
                const destination = (l.destination || '').toLowerCase();
                return destination.includes(lowerQuery) || mtsId.toLowerCase().includes(lowerQuery);
            })
            .map(l => ({ ...l, search_type: 'lead' as const }));

        const itineraryResults = itineraries
            .filter(i => {
                if (!i || !i.creative_title) return false;
                return i.creative_title.toLowerCase().includes(lowerQuery);
            })
            .map(i => ({ ...i, search_type: 'itinerary' as const }));

        const staffResults = (profile.role === 'Super Admin' || profile.role === 'Manager')
            ? staff
                .filter(s => {
                    if (!s) return false;
                    const name = (s.name || '').toLowerCase();
                    const email = (s.email || '').toLowerCase();
                    return name.includes(lowerQuery) || email.includes(lowerQuery);
                })
                .map(s => ({ ...s, search_type: 'staff' as const }))
            : [];
        
        const branchResults = (profile.role === 'Super Admin')
            ? branches
                .filter(b => {
                    if (!b || !b.name) return false;
                    return b.name.toLowerCase().includes(lowerQuery);
                })
                .map(b => ({ ...b, search_type: 'branch' as const }))
            : [];
        
        return [...customerResults, ...leadResults, ...itineraryResults, ...staffResults, ...branchResults].slice(0, 15);

    }, [query, customers, leads, itineraries, staff, branches, profile.role]);

    const handleSelect = (item: SearchResult) => {
        if (item.search_type === 'lead') {
            sessionStorage.setItem('viewLeadId', item.id.toString());
            navigate('/leads/all');
        } else if (item.search_type === 'customer') {
            sessionStorage.setItem('viewCustomerId', item.id.toString());
            navigate('/customers');
        } else if (item.search_type === 'itinerary') {
            sessionStorage.setItem('viewItineraryId', item.id.toString());
            navigate('/itineraries');
        } else if (item.search_type === 'staff') {
             sessionStorage.setItem('viewStaffId', item.id.toString());
             navigate('/employees');
        } else if (item.search_type === 'branch') {
             sessionStorage.setItem('viewBranchId', item.id.toString());
             navigate('/branches');
        }
        setIsActive(false);
        setQuery('');
    };
    
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsActive(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const ResultItem: React.FC<{item: SearchResult}> = ({ item }) => {
        if (!item) return null;
        
        let title = '';
        let subtitle = '';

        if (item.search_type === 'customer') {
            title = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown Customer';
            subtitle = `Customer - ${item.email || 'No email'}`;
        } else if (item.search_type === 'lead') {
            title = item.destination || 'No destination';
            const customer = customers.find(c => c.id === item.customer_id);
            subtitle = `Lead for ${customer?.first_name || 'Unknown'}`;
        } else if (item.search_type === 'itinerary') {
            title = item.creative_title || 'Untitled Itinerary';
            subtitle = `Itinerary - ${item.duration || 'No duration'}`;
        } else if (item.search_type === 'staff') {
            title = item.name || 'Unknown Staff';
            subtitle = `Staff - ${item.email || 'No email'}`;
        } else if (item.search_type === 'branch') {
            title = item.name || 'Unknown Branch';
            subtitle = `Branch - ${item.address?.city || 'No city'}`;
        }

        return (
            <li onClick={() => handleSelect(item)} className="p-3 hover:bg-gray-600 cursor-pointer rounded-md">
                <p className="font-semibold text-sm text-gray-100">{title}</p>
                <p className="text-xs text-gray-400">{subtitle}</p>
            </li>
        )
    }

    return (
        <div className="relative w-full max-w-md" ref={searchRef}>
            <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <IconSearch className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                    type="text"
                    placeholder="Search customers, leads, MTS ID, itineraries..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setIsActive(true)}
                    className="bg-gray-800 text-white placeholder:text-gray-400 border-gray-700 focus-visible:ring-blue-500 pl-10 h-9 w-full"
                />
            </div>
            {isActive && query.length > 1 && (
                <div className="absolute top-full mt-2 w-full bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-50 p-2 max-h-96 overflow-y-auto">
                    {results.length > 0 ? (
                        <ul>
                           {results.map((item: any, index: number) => <ResultItem key={`${item.search_type}-${item.id}-${index}`} item={item} />)}
                        </ul>
                    ) : (
                        <p className="p-4 text-center text-sm text-gray-400">No results found.</p>
                    )}
                </div>
            )}
        </div>
    );
};


const IconMenu: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
);

const Header: React.FC<{ profile: LoggedInUser; onMenuClick?: () => void }> = ({ profile, onMenuClick }) => {
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);
  const { navigate } = useRouter();
  const { notifications } = useData();
  const unreadNotifications = useMemo(() => notifications.filter(n => !n.read_at).length, [notifications]);

  const { session } = useAuth();
  const { addToast } = useToast();

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
            setIsAddMenuOpen(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);





  const handleAddNew = (itemType: 'customer' | 'lead' | 'branch' | 'staff') => {
    sessionStorage.setItem('action', `new-${itemType}`);
    switch(itemType) {
        case 'customer': navigate('/customers'); break;
        case 'lead': navigate('/leads/all'); break;
        case 'branch': navigate('/branches'); break;
        case 'staff': navigate('/employees'); break;
    }
    setIsAddMenuOpen(false);
  };

  return (
    <>
      <header className="h-14 sm:h-16 bg-[#111827] border-b border-gray-700/50 flex items-center justify-between px-3 sm:px-6 shrink-0 gap-2">
        {/* Mobile: hamburger to open sidebar */}
        {onMenuClick && (
          <button onClick={onMenuClick} className="md:hidden p-2 -ml-1 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white" aria-label="Open menu">
            <IconMenu className="w-6 h-6" />
          </button>
        )}
        <div className="hidden md:block flex-1 min-w-0 max-w-md">
          <GlobalSearch profile={profile} />
        </div>
        <div className="flex-1 md:flex-none flex items-center justify-end gap-1 sm:gap-2 md:space-x-4">
          <NotificationsBell onClick={() => setIsNotificationsOpen(prev => !prev)} unreadCount={unreadNotifications} />

          <div className="relative" ref={addMenuRef}>
            <button onClick={() => setIsAddMenuOpen(prev => !prev)} className="p-2 rounded-md text-gray-400 hover:bg-gray-700 hover:text-white">
              <IconPlus className="w-6 h-6" />
            </button>
            {isAddMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-48 bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-50 p-2">
                  <ul className="text-sm text-gray-200">
                      <li onClick={() => handleAddNew('lead')} className="p-2 hover:bg-gray-600 rounded-md cursor-pointer">New Lead</li>
                      <li onClick={() => handleAddNew('customer')} className="p-2 hover:bg-gray-600 rounded-md cursor-pointer">New Customer</li>
                      {(profile.role === 'Super Admin' || profile.role === 'Manager') && (
                          <li onClick={() => handleAddNew('staff')} className="p-2 hover:bg-gray-600 rounded-md cursor-pointer">New Staff</li>
                      )}
                      {profile.role === 'Super Admin' && (
                          <li onClick={() => handleAddNew('branch')} className="p-2 hover:bg-gray-600 rounded-md cursor-pointer">New Branch</li>
                      )}
                  </ul>
              </div>
            )}
          </div>
           <UserStatus />
        </div>
      </header>
      <NotificationsDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} />
    </>
  );
};

export default Header;
