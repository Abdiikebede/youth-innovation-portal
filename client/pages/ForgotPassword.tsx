import { useState } from "react"
import { Link } from "react-router-dom"
import { api } from "@/services/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Lightbulb, Mail, ArrowLeft, Flag, CheckCircle } from "lucide-react"

export default function ForgotPassword() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await api.forgotPassword(email)
      setEmailSent(true)
    } catch (error) {
      console.error('Password reset failed:', error)
      setEmailSent(true) // Still show success for security
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-innovation-50 via-background to-ethiopia-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="flex items-center justify-center w-12 h-12 bg-innovation-500 rounded-xl">
              <Lightbulb className="h-6 w-6 text-white" />
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-base font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#2e9891] to-[#5fd1ca] tracking-wide">MinT Innovation</span>
            </div>
          </div>
          <h1 className="text-2xl font-bold">Reset Password</h1>
          <p className="text-muted-foreground">
            {emailSent 
              ? "Check your email for reset instructions"
              : "Enter your email to receive reset instructions"
            }
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center flex items-center justify-center">
              {emailSent ? (
                <>
                  <CheckCircle className="h-5 w-5 text-innovation-500 mr-2" />
                  Email Sent
                </>
              ) : (
                "Forgot Password"
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {emailSent ? (
              <div className="text-center space-y-4">
                <div className="p-4 bg-innovation-50 rounded-lg">
                  <p className="text-sm text-innovation-700">
                    We've sent password reset instructions to <strong>{email}</strong>
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  Didn't receive the email? Check your spam folder or try again.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => setEmailSent(false)}
                  className="w-full"
                >
                  Try Different Email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter the email address associated with your Innovation Portal account
                  </p>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-innovation-500 hover:bg-innovation-600"
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send Reset Instructions"}
                </Button>
              </form>
            )}

            <div className="text-center">
              <Link 
                to="/login" 
                className="inline-flex items-center text-sm text-innovation-600 hover:text-innovation-700"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Sign In
              </Link>
            </div>

            {!emailSent && (
              <div className="text-center text-sm">
                <span className="text-muted-foreground">Don't have an account? </span>
                <Link to="/register" className="text-innovation-600 hover:text-innovation-700 font-medium">
                  Sign up
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
