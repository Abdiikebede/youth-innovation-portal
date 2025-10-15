import { Mail, Phone, MapPin, Linkedin, Twitter, Send, ArrowUp } from "lucide-react";

export function PublicFooter() {
  return (
    <footer id="contact" className="relative text-white" style={{ backgroundColor: '#087684' }}>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Quick Links and Contact Container */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 md:col-span-2">
              {/* Quick Links */}
              <div>
                <h5 className="text-base font-semibold mb-4">Quick Links</h5>
                <ul className="space-y-3 text-white/90">
                  <li><a href="#" className="hover:underline">Home</a></li>
                  <li><a href="#" className="hover:underline">Programs</a></li>
                  <li><a href="#contact" className="hover:underline">Contact</a></li>
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h5 className="text-base font-semibold mb-4">Contact</h5>
                <div className="space-y-3 text-white/90">
                  <div className="flex items-center space-x-3">
                    <Phone className="h-4 w-4" />
                    <span className="text-sm">+251118132191</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4" />
                    <span className="text-sm">contact@mint.gov.et</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <MapPin className="h-4 w-4" />
                    <span className="text-sm">www.mint.gov.et</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Follow Us */}
            <div>
              <h5 className="text-base font-semibold mb-4">Follow Us</h5>
              <div className="flex flex-wrap gap-2">
                <a href="https://www.facebook.com/MInT.Ethiopia" target="_blank" rel="noopener noreferrer"
                   className="p-2 rounded-md" style={{ backgroundColor: '#435258' }}>
                  <svg className="h-4 w-4 text-[#1877F2]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </a>
                <a href="https://www.linkedin.com/company/ministry-of-innovation-and-technology-ethiopia/" target="_blank" rel="noopener noreferrer"
                   className="p-2 rounded-md" style={{ backgroundColor: '#435258' }}>
                  <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                </a>
                <a href="#" target="_blank" rel="noopener noreferrer"
                   className="p-2 rounded-md" style={{ backgroundColor: '#435258' }}>
                  <Twitter className="h-4 w-4 text-[#1DA1F2]" />
                </a>
                <a href="#" target="_blank" rel="noopener noreferrer"
                   className="p-2 rounded-md" style={{ backgroundColor: '#435258' }}>
                  <Send className="h-4 w-4 text-[#26A5E4]" />
                </a>
                <a href="https://www.youtube.com/@MinistryofInnovationandTechnol" target="_blank" rel="noopener noreferrer"
                   className="p-2 rounded-md" style={{ backgroundColor: '#435258' }}>
                  <svg className="h-4 w-4 text-[#FF0000]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Back to Top Button */}
      <button
        aria-label="Back to top"
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center h-11 w-11 rounded-full shadow-lg text-white"
        style={{ backgroundColor: '#2e9891' }}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </footer>
  );
}
